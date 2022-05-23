const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express();
require('dotenv').config()
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());


//DB configs

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.skpwg.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


async function run() {
  try {
    await client.connect();

    const partCollection = client.db('robotics_parts').collection('parts');
    const reviewCollection = client.db('robotics_parts').collection('reviews');

    //get all parts
    app.get('/parts', async (req, res) => {
      const result = await partCollection.find({}).toArray();
      res.send(result);
    })

    //get all reviews
    app.get('/reviews', async (req, res) => {
      const result = await reviewCollection.find({}).toArray();
      res.send(result);
    })


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
  console.log(`Rbotics Parts Store listening on port ${port}`)
});