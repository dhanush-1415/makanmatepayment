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

    const unitAmount = Math.round((item.Price + item.Tax) * 100);
    

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


async function createShippingPrice(shippingCost) {
  try {
    const shippingPrice = await stripe.prices.create({
      unit_amount: Math.round(shippingCost * 100),
      currency: 'SGD',
      product_data: {
        name: 'Shipping Cost',
        type: 'service',
      },
    });

    return shippingPrice.id;
  } catch (error) {
    console.error('Error creating shipping price:', error);
    throw error;
  }
}


app.post('/create-checkout-session', async (req, res) => {
  try {
    const {
      ShippingCost,
      OrderDetail,
      url,
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

    if (ShippingCost > 0) {
      const shippingPriceId = await createShippingPrice(ShippingCost);
      lineItems.push({
        price: shippingPriceId,
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: url === 'makanmate' ? 'https://makanmate.com/order/success' : 'https://catchyfive.com/success',
      cancel_url: url === 'makanmate' ? 'https://makanmate.com/order/failed' : 'https://catchyfive.com/failed',
      submit_type: 'auto',
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
