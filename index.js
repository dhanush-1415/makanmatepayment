const express = require('express');
const bodyParser = require('body-parser');
const stripe = require('stripe')('sk_test_51N00U8FFReMpJzWzW0k62c5BgKrjWNJaFnu3DHoO8PUOKie0XyHlJBwVKQaLPsORqJ9udcg2RDWNlbqExcrDxecF00uNWboKYU');
const cors = require('cors'); 

const app = express();

app.use(bodyParser.json());
app.use(cors()); 

async function createProductAndPrice(item) {
  try {
    const product = await stripe.products.create({
      name: item.ProductName,
      type: 'service', 
    });

    const unitAmount = Math.round(item.Total * 10);

    const price = await stripe.prices.create({
      product: product.id,
      currency: 'SGD',
      unit_amount: unitAmount, 
    });

    return price.id; 
  } catch (error) {
    console.error('Error creating product and price:', error);
    throw error; 
  }
}


app.post('/create-checkout-session', async (req, res) => {
  try {
    const {
      OrderDate,
      CustomerId,
      CustomerName,
      CustomerAddress,
      PostalCode,
      Total,
      NetTotal,
      PaymentType,
      OrderDetail,
    } = req.body[0].products;

    if (!Array.isArray(OrderDetail)) {
      res.status(400).json({ error: 'OrderDetail should be an array of items' });
      return;
    }

    const productPriceIds = await Promise.all(
      OrderDetail.map(async (item) => {
        return createProductAndPrice(item);
      })
    );

    const lineItems = OrderDetail.map((item, index) => {
      return {
        price: productPriceIds[index],
        quantity: item.Qty,
      };
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: 'https://catchyfive.com/success', 
      cancel_url: 'https://catchyfive.com/failed', 
      // customer: CustomerId,
      submit_type: 'auto',
      // metadata: {
      //   OrderDate,
      //   CustomerName,
      //   CustomerAddress,
      //   PostalCode,
      //   Total,
      //   NetTotal,
      //   PaymentType,
      //   OrderDetail: JSON.stringify(OrderDetail),
      // },
      currency: 'SGD', 
    });
    

    res.json({ sessionId: session.id });
  } catch (error) {
    console.error('Error in create-checkout-session:', error);
    res.status(500).json({ error: error.message });
  }
})

const port = 3001; 
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
