const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectID, ObjectId } = require('mongodb');
const app = express();
require('dotenv').config()
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

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
    const profileCollection = client.db('robotics_parts').collection('profiles');

    //verify Admin
    const verifyAdmin = async (req, res, next) => {
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({
        email: requester,
      });
      if (requesterAccount.role === "admin") {
        next();
      } else {
        res.status(403).send({ message: "forbidden access" });
      }
    };

    //getting an user's admin status
    app.get("/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === "admin";
      res.send({ admin: isAdmin });
    });

    //put route for admin:  make admin
    app.put("/user/admin/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const updateDoc = {
        $set: { role: "admin" },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

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

    //get all users
    app.get('/user', verifyJWT, async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
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

      //add a profile
      const profile = {
        name: user.name,
        email: user.email
      }
      const profileCreated = await profileCollection.updateOne(filter, {$set: profile}, option);

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

    //delete an order
    app.delete("/order/:orderId", verifyJWT, async (req, res) => {
      const id = req.params.orderId;
      const filter = { _id: ObjectId(id) };
      const result = await orderCollection.deleteOne(filter);
      res.send(result);
    });

    //post create payment intent
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { totalPrice } = req.body;
      const amount = totalPrice*100;
    
      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        automatic_payment_methods: {
          enabled: true,
        },
      });
    
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    //store payment by ID
    app.patch("/order/:orderId", verifyJWT, async (req, res) => {
      const orderId = req.params.orderId;
      const payment = req.body;
      const filter = {_id: ObjectId(orderId)};
      const updatedDoc = {
        $set: {
          paid: payment.paid,
          transactionId: payment.transactionId,
        },
      };
      const updatedResult = await orderCollection.updateOne(filter, updatedDoc);
      res.send(updatedResult);
    });

    //get an order by ID
    app.get("/order/:orderId", verifyJWT, async (req, res) => {
      const orderId = req.params.orderId;
      const query = {_id: ObjectId(orderId)};
      const order = await orderCollection.findOne(query);
      res.send(order);
    })

    //add a review
    app.post("/review", verifyJWT, async (req, res) => {
      const review = req.body;
      const result = await reviewCollection.insertOne(review);
      return res.send({ success: true, result });
    });

    //update profile
    app.put("/profile/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const updatedDoc = {$set : req.body};
      const result = await profileCollection.updateOne(filter, updatedDoc, {upsert:true});
      res.send(result);
    })

    //get a profile info by email
    app.get("/profile/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = {email: email};
      const profile = await profileCollection.findOne(query);
      res.send(profile);
    })
    
    //get all orders
    // app.get("/order", verifyJWT, verifyAdmin, async (req, res) => {
    //   const orders = await orderCollection.find().toArray();
    //   res.send(orders);
    // })
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