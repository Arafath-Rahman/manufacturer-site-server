const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectID } = require('mongodb');
const app = express();
require('dotenv').config()
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());


//DB configs

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.skpwg.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

//middleware to verifyJWT
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorized access." });
  }
  const accessToken = authHeader.split(" ")[1];
  jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: "forbidden access" });
    }
    req.decoded = decoded; //if we add a property to req, then next function will get the info from middleware
    next();
  });
}


async function run() {
  try {
    await client.connect();

    const userCollection = client.db('robotics_parts').collection('users');
    const partCollection = client.db('robotics_parts').collection('parts');
    const reviewCollection = client.db('robotics_parts').collection('reviews');
    const orderCollection = client.db('robotics_parts').collection('orders');

    //get all parts
    app.get('/parts', async (req, res) => {
      const result = await partCollection.find({}).toArray();
      res.send(result);
    })

    //get a part detail
    app.get('/parts/:partId', async (req, res) => {
      const partId = req.params.partId;
      const query = {_id: ObjectID(partId)};
      const result = await partCollection.findOne(query);
      res.send(result);
    })

    //get all reviews
    app.get('/reviews', async (req, res) => {
      const result = await reviewCollection.find({}).toArray();
      res.send(result);
    })
    
    //get an user
    app.get('/user/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      res.send(result);
    })


    //put route for users: upsert(update/insert) users
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const option = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, option);
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1h" }
      );
      res.send({ result, token });
    });

    //add an order
    app.post("/order", async (req, res) => {
      const order = req.body;
      const result = await orderCollection.insertOne(order);
      // sendAppointmentEmail(booking);
      return res.send({ success: true, result });
    });

    //get orders of a specific user
    app.get("/order", verifyJWT, async (req, res) => {
      const userEmail = req.query.userEmail;
      const decodedEmail = req.decoded.email;
      if (userEmail === decodedEmail) {
        const query = { userEmail: userEmail };
        const orders = await orderCollection.find(query).toArray();
        res.send(orders);
      } else {
        return res.status(403).send({ message: "forbidden access" });
      }
    });


  }
  finally {
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
  res.send('Hello from Robotics parts store!')
});

app.listen(port, () => {
  console.log(`Robotics Parts Store listening on port ${port}`)
});