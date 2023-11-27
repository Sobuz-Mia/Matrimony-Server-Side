const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

// password:JsBmS8fCTlmoPtA1
// userName:Matrimony

const uri = `mongodb+srv://${process.env.USER_NAME}:${process.env.USER_PASS}@cluster0.sbw5eqf.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const biodatasCollection = client.db("matrimonyDB").collection("biodatas");
    const premiumCollection = client
      .db("matrimonyDB")
      .collection("premiumBiodata");

    // User premium or not
    app.get("/api/check-user-premium", async(req, res) => {
      const email = req.query.email;
      const id = req.query.id;
      const filter ={biodataId:parseInt(id)}
      const query = { email: email };
      const user = await premiumCollection.findOne(query);
      if(!user || user.premiumRequest !== "premium"){
        return res.send({message:'you are not premium member'})
      }
      const result= await premiumCollection.findOne(filter)
      res.send(result)
      console.log('Data',result)
    });

    // premium bio data operation start

    app.post("/api/make-premium/request", async (req, res) => {
      const requestInfo = req.body;
      const result = await premiumCollection.insertOne(requestInfo);
      res.send(result);
    });

    // get all biodata
    app.get("/api/biodatas", async (req, res) => {
      const result = await biodatasCollection.find().toArray();
      res.send(result);
    });
    // get similar data using gender
    app.get("/api/similar-data", async (req, res) => {
      const gender = req.query.gender;
      const query = { biodataType: gender };
      const result = await biodatasCollection.find(query).toArray();
      res.send(result);
    });
    // get single biodata using id
    app.get("/api/biodata/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await biodatasCollection.findOne(query);
      res.send(result);
    });
    // get user based data
    app.get("/api/singleBiodata", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await biodatasCollection.findOne(query);
      res.send(result);
    });
    // create biodata
    app.post("/api/edit-create/biodata", async (req, res) => {
      const biodata = req.body;
      const existingBiodataId = await biodatasCollection.countDocuments();
      const newBiodata = {
        biodataId: existingBiodataId + 1,
        age: biodata.age,
        biodataType: biodata.biodataType,
        dateOfBirth: biodata.dateOfBirth,
        fatherName: biodata.fatherName,
        height: biodata.height,
        motherName: biodata.motherName,
        name: biodata.name,
        email: biodata.email,
        occupation: biodata.occupation,
        partnerHeight: biodata.partnerHeight,
        partnerWeight: biodata.partnerWeight,
        permanentDivision: biodata.permanentDivision,
        photoUrl: biodata.photoUrl,
        presentDivision: biodata.presentDivision,
        race: biodata.race,
        weight: biodata.weight,
      };
      const result = await biodatasCollection.insertOne(newBiodata);
      res.send(result);
    });
    app.patch("/api/update/biodata/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const biodata = req.body;
      const updateBiodata = {
        $set: {
          age: biodata.age,
          biodataType: biodata.biodataType,
          dateOfBirth: biodata.dateOfBirth,
          fatherName: biodata.fatherName,
          height: biodata.height,
          motherName: biodata.motherName,
          name: biodata.name,
          occupation: biodata.occupation,
          partnerHeight: biodata.partnerHeight,
          partnerWeight: biodata.partnerWeight,
          permanentDivision: biodata.permanentDivision,
          photoUrl: biodata.photoUrl,
          presentDivision: biodata.presentDivision,
          race: biodata.race,
          weight: biodata.weight,
        },
      };
      const result = await biodatasCollection.updateOne(filter, updateBiodata);
      res.send(result);
    });
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Matrimony server is running");
});

app.listen(port, () => {
  console.log(`Matrimony server is running on port ${port}`);
});
