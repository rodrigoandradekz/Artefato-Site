import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';

const client = new MercadoPagoConfig({
  accessToken: 'TEST-779884578819695-100413-b4cdeb236e3aee01ef664f0ff5504a70-465011336'
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const { tipo, items, payer, frete, token, installments, payment_method_id } = req.body;

  try {
    if (tipo === 'preference') {
      // Criar preferência (Pix ou Boleto via redirect)
      const preference = new Preference(client);
      const result = await preference.create({
        body: {
          items: items.map(item => ({
            title: item.nome,
            quantity: item.qty || 1,
            unit_price: parseFloat(item.preco),
            currency_id: 'BRL'
          })),
          payer: {
            name: payer.nome,
            email: payer.email,
            identification: { type: 'CPF', number: payer.cpf?.replace(/\D/g, '') }
          },
          shipments: {
            cost: frete || 0,
            mode: 'not_specified'
          },
          payment_methods: {
            excluded_payment_types: [{ id: 'credit_card' }, { id: 'debit_card' }],
            installments: 1
          },
          back_urls: {
            success: `${req.headers.origin || 'https://artefato-site.vercel.app'}/pedido-confirmado.html`,
            failure: `${req.headers.origin || 'https://artefato-site.vercel.app'}/checkout.html`,
            pending: `${req.headers.origin || 'https://artefato-site.vercel.app'}/pedido-confirmado.html`
          },
          auto_return: 'approved',
          statement_descriptor: 'ARTEFATO CAFES',
          external_reference: `pedido_${Date.now()}`
        }
      });
      return res.status(200).json({ id: result.id, init_point: result.init_point });
    }

    if (tipo === 'cartao') {
      // Pagamento direto com cartão (tokenizado)
      const payment = new Payment(client);
      const total = items.reduce((s, i) => s + parseFloat(i.preco) * (i.qty || 1), 0) + (frete || 0);
      
      const result = await payment.create({
        body: {
          transaction_amount: total,
          token: token,
          installments: installments || 1,
          payment_method_id: payment_method_id,
          payer: {
            email: payer.email,
            identification: { type: 'CPF', number: payer.cpf?.replace(/\D/g, '') }
          },
          description: `Artefato Cafés — ${items.map(i => i.nome).join(', ')}`,
          external_reference: `pedido_${Date.now()}`,
          statement_descriptor: 'ARTEFATO CAFES'
        }
      });

      return res.status(200).json({
        status: result.status,
        status_detail: result.status_detail,
        id: result.id
      });
    }

    return res.status(400).json({ error: 'Tipo inválido' });

  } catch (error) {
    console.error('MP Error:', error);
    return res.status(500).json({ error: error.message || 'Erro ao processar pagamento' });
  }
}
