const cors = require('cors');
const express = require('express');
const app = express()
const port = process.env.PORT || 5000
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const jwt = require('jsonwebtoken');

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
    const orderCollection = client.db("drillco").collection('order');
    // get all products
    app.get('/products', jwtVerifyUser, async (req, res) => {
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
    // post order
    app.post('/order', jwtVerifyUser, async(req,res)=>{
      const order = req.body
      const result = await orderCollection.insertOne(order)
      res.send(result)

    })



    // authentication send token
    app.post('/get-token', async (req, res) => {
      const user = req.body
      const accessToken = jwt.sign(user, process.env.ACCESS_JWT_TOKEN_SECRET, {
        expiresIn: '2d'
      });
      res.send(accessToken)
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