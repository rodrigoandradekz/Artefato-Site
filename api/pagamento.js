export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const ACCESS_TOKEN = 'TEST-779884578819695-100413-b4cdeb236e3aee01ef664f0ff5504a70-465011336';
  const { tipo, items, payer, frete, token, installments, payment_method_id } = req.body;

  try {
    if (tipo === 'preference') {
      const body = {
        items: items.map(item => ({
          title: item.nome,
          quantity: item.qty || 1,
          unit_price: parseFloat(item.preco),
          currency_id: 'BRL'
        })),
        payer: {
          name: payer.nome,
          email: payer.email,
          identification: { type: 'CPF', number: (payer.cpf||'').replace(/\D/g,'') }
        },
        shipments: { cost: frete || 0, mode: 'not_specified' },
        payment_methods: {
          excluded_payment_types: [{ id: 'credit_card' }, { id: 'debit_card' }]
        },
        back_urls: {
          success: 'https://artefato-site.vercel.app/pedido-confirmado.html',
          failure: 'https://artefato-site.vercel.app/checkout.html',
          pending: 'https://artefato-site.vercel.app/pedido-confirmado.html'
        },
        auto_return: 'approved',
        statement_descriptor: 'ARTEFATO CAFES',
        external_reference: `ARF${Date.now().toString().slice(-6)}`
      };

      const r = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ACCESS_TOKEN}`
        },
        body: JSON.stringify(body)
      });
      const data = await r.json();
      if (data.id) {
        return res.status(200).json({ id: data.id, init_point: data.init_point });
      }
      return res.status(400).json({ error: data.message || 'Erro ao criar preferência' });
    }

    if (tipo === 'cartao') {
      const cart = items || [];
      const sub = cart.reduce((s, i) => s + parseFloat(i.preco) * (i.qty || 1), 0);
      const total = sub + parseFloat(frete || 0);

      const body = {
        transaction_amount: Math.round(total * 100) / 100,
        token: token,
        installments: installments || 1,
        payment_method_id: payment_method_id,
        payer: {
          email: payer.email,
          identification: { type: 'CPF', number: (payer.cpf||'').replace(/\D/g,'') }
        },
        description: `Artefato Cafés — ${cart.map(i => i.nome).join(', ')}`,
        external_reference: `ARF${Date.now().toString().slice(-6)}`,
        statement_descriptor: 'ARTEFATO CAFES'
      };

      const r = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'X-Idempotency-Key': `artefato-${Date.now()}`
        },
        body: JSON.stringify(body)
      });
      const data = await r.json();
      return res.status(200).json({
        status: data.status,
        status_detail: data.status_detail,
        id: data.id,
        error: data.message
      });
    }

    return res.status(400).json({ error: 'Tipo inválido' });

  } catch (error) {
    console.error('Erro pagamento:', error);
    return res.status(500).json({ error: error.message || 'Erro interno' });
  }
}
