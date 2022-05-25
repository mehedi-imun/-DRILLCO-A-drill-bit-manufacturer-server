const cors = require('cors');
const express = require('express');
const app = express()
const port = process.env.PORT || 5000
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
//middleware
app.use(cors())
app.use(express.json());

const jwtVerifyUser = (req, res, next) => {
  const authToken = req.headers.authorization;
  const token = authToken?.split(' ')[1];
  // console.log(token);
  if (token === 'null') {
    return res.status(401).send({ massage: ('unauthorize') })
  } else {

    jwt.verify(token, process.env.ACCESS_JWT_TOKEN_SECRET, (err, decoded) => {
      if (err) {
        return res.status(403).send({ massage: ('forbidden access') })
      } else {
        req.decoded = decoded
        next()
      }
    })
  }
};


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.z4wxj.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


async function run() {
  try {
    await client.connect();
    const productCollection = client.db("drillco").collection('products');
    const usersCollection = client.db("drillco").collection('user');
    const orderCollection = client.db("drillco").collection('order');
    const reviewsCollection = client.db("drillco").collection('reviews');
    const paymentCollection = client.db("drillco").collection('payment');
    // get all products
    app.get('/products', async (req, res) => {
      const result = await productCollection.find().toArray()
      res.send(result)
    });
    // get product by id
    app.get('/product/:id', jwtVerifyUser, async (req, res) => {
      const id = req.params.id
      const query = { _id: ObjectId(id) }
      const result = await productCollection.findOne(query);
      res.send(result)

    });
    // update product quantity by id
    app.put('/update-quantity/:id', jwtVerifyUser, async (req, res) => {
      const id = req.params.id;
      const quantity = req.body.updateQuantity
      console.log(quantity);
      const filter = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: {
          availableQuantity: quantity,
        }

      }
      const result = await productCollection.updateOne(filter, updatedDoc);
      res.send(result)
    })


    // post order
    app.post('/order', jwtVerifyUser, async (req, res) => {
      const order = req.body
      const result = await orderCollection.insertOne(order)
      res.send(result)

    });
    // get order by email 
    app.get('/order', jwtVerifyUser, async (req, res) => {
      const userEmail = req.query.userEmail
      const decodedEmail = req?.decoded?.email
      if (userEmail === decodedEmail) {
        const query = { userEmail: userEmail };
        const result = await orderCollection.find(query).toArray();
        return res.send(result)
      } else {
        return res.status(403).send({ message: 'forbidden' })
      }

    });
    // get order by id
    app.get('/order/:id', jwtVerifyUser, async(req,res)=>{
      const id = req.params.id;
      const query = {_id:ObjectId(id)};
      const result = await orderCollection.findOne(query);
      res.send(result)
    })

    // delete order api
    app.delete('/order/:email', jwtVerifyUser, async (req, res) => {
      const email = req.params.email;
      const filter = { userEmail: email }
      const result = await orderCollection.deleteOne(filter)
      res.send(result)
    });
    // get all user
    app.get('/users', jwtVerifyUser, async (req, res) => {
      const result = await usersCollection.find().toArray()
      res.send(result)
    });
    // make admin 
    app.put('/user/admin/:email', jwtVerifyUser, async (req, res) => {
      const requester =  req.decoded.email
      const requesterAccount = await usersCollection.findOne({email:requester});
      const email = req.params.email;
      if(requesterAccount.role === 'admin'){
        const filter = { email: email }
      const updatedDoc = {
        $set: { role: 'admin' },
      };
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result)
      }else{
        return res.status(403).send({ message: 'forbidden' })
      }
      
    });
    // delete admin 
    app.delete('/user/admin:email', async (req, res) => {
      const email = req.params.email;
      const filter = { email: email }
      const result = await usersCollection.deleteOne(filter)
      res.send(result)
    });
    // get admin 
    app.get('/admin/:email', jwtVerifyUser, async (req,res)=>{
      const email = req.params.email
      const user = await usersCollection.findOne({email:email});
      const isAdmin = user.role === 'admin'
      res.send({admin:isAdmin})
    });

    // get reviews 
    app.get('/reviews' , async(req,res)=>{
      const result = await reviewsCollection.find().toArray()
      res.send(result)
    })



    // authentication send token and save user 
    app.put('/users/:email', async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email }
      const options = { upsert: true };
      const updatedDoc = {
        $set: user,
      };
      const result = await usersCollection.updateOne(filter, updatedDoc, options);
      const accessToken = jwt.sign({ email: email }, process.env.ACCESS_JWT_TOKEN_SECRET, { expiresIn: '2 days' });
      res.send({ result, accessToken })
    });

    // payment 
    app.post("/create-payment-intent",jwtVerifyUser, async (req, res) => {
      const service = req.body;
      const price = service.price
      const amount = price*100;

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types:['card']
    
      });
    
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // post payment 
    app.patch('/payment-booking/:id', jwtVerifyUser, async(req,res)=>{
      const id = req.params.id;
      const filter = {_id: ObjectId(id)};
      const payment = req.body;
      const updatedDoc = {
       $set:{
        transactionID : payment.transactionId,
        paid:true

       }

      }
      const result = await orderCollection.updateOne(filter,updatedDoc)
      const updatedBooking = await paymentCollection.insertOne(payment)
      res.send(result)
    })


  } finally {
    //   await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('drillco server is running')
})
app.listen(port, () => {
  console.log('lesen port ', port);
})