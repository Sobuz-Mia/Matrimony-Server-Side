const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.Stripe_Payment_Secret_Key);
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
    const favouritesCollection = client
      .db("matrimonyDB")
      .collection("favourites");
    const paymentCollection = client.db("matrimonyDB").collection("payments");
    const usersCollection = client.db("matrimonyDB").collection("users");
    const successStoryCollection = client
      .db("matrimonyDB")
      .collection("successStory");

    // jwt token
    app.post("/api/jwt/token", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "1h",
      });
      res.send({ token });
    });
    // middleware
    const verifyToken = (req, res, next) => {
      // console.log("varify token", req.headers);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized no token found" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized token error" });
        }
        req.decoded = decoded;
        next();
      });
    };

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === "Admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // count down all data

    app.get("/api/count-data", async (req, res) => {
      const totalBiodata = await biodatasCollection.countDocuments();
      const maleData = await biodatasCollection.countDocuments({
        biodataType: "male" || "Male",
      });
      const femaleData = await biodatasCollection.countDocuments({
        biodataType: "female" || "Female",
      });
      const premiumData = await premiumCollection.countDocuments();
      const marriedComplete = await successStoryCollection.countDocuments();
      const aggregationResult = await paymentCollection
        .aggregate([
          {
            $group: {
              _id: null,
              totalPrice: { $sum: "$price" },
            },
          },
        ])
        .toArray();
      const totalPrice =
        aggregationResult.length > 0 ? aggregationResult[0].totalPrice : 0;
      res.send({
        totalBio: totalBiodata,
        maleData: maleData,
        femaleData: femaleData,
        premiumData: premiumData,
        totalRevenue: totalPrice,
        completeMarried: marriedComplete,
      });
    });
    // get successStory
    app.get("/api/success-story", async (req, res) => {
      const result = await successStoryCollection
        .find()
        .sort({ marriageDate: 1 })
        .toArray();
      res.send(result);
    });
    // get favorites data
    app.get("/api/favorite-data", async (req, res) => {
      const email = req.query.email;
      const query = { userEmail: email };
      const result = await favouritesCollection.find(query).toArray();
      res.send(result);
    });
    // delete favorite item
    app.delete("/api/delete-favorite/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await favouritesCollection.deleteOne(query);
      res.send(result);
    });
    // User premium or not
    app.get("/api/check-user-premium", async (req, res) => {
      const email = req.query.email;
      const id = req.query.id;
    
      const filter = { biodataId:parseInt(id)};
      console.log(filter)
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (!user || user.userStatus !== "premium") {
        return res.send({ message: "you are not premium member" });
      }
      const result = await biodatasCollection.findOne(filter);
      res.send(result);
    });

    // premium bio data operation start

    app.get("/api/premium", async (req, res) => {
      const result = await premiumCollection.find().toArray();
      res.send(result);
    });

    app.patch("/api/user/premium/data/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { biodataId: parseInt(id) };
      const updateDoc = {
        $set: {
          premiumRequest: "premium",
        },
      };
      await biodatasCollection.updateOne(filter,updateDoc)
      const result = await premiumCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    app.post("/api/make-premium/request", async (req, res) => {
      const requestInfo = req.body;
      const result = await premiumCollection.insertOne(requestInfo);
      res.send(result);
    });
    // get all contact request data for admin
    app.get("/api/all-contact/requested-data", async (req, res) => {
      const result = await paymentCollection.find().toArray();
      res.send(result);
    });
    // get contact requets data
    app.get("/api/contact-request",verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });
    app.patch("/api/update-status/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { biodataId: parseInt(id) };
      const updateDoc = {
        $set: {
          status: "approved",
        },
      };
      const result = await paymentCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    // get all user data
    app.get("/api/users",verifyToken,verifyAdmin,async (req, res) => {
      let query ={};
      const searchValue = req.query.search ? req.query.search.toLowerCase() : '';
      if (searchValue) {
        query.userName = { $regex: new RegExp(searchValue, "i") }; 
      }
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/api/users/admin",verifyToken, async (req, res) => {
      const email = req.query.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Forbidden email not match" });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "Admin";
      }
      res.send({ admin });
    });
    // user save to database
    app.post("/api/users", async (req, res) => {
      const user = req.body;
      console.log(user);
      const query = { email: user.email };
      const isExisting = await usersCollection.findOne(query);
      if (isExisting) {
        return res.send({ message: "user already exist" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });
    // user update to admin
    app.patch("/api/user/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "Admin",
        },
      };
      const result = await usersCollection.updateOne(query, updateDoc);
      res.send(result);
    });
    // create premium user
    app.patch("/api/user/premium/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id)};
      const updateDoc = {
        $set: {
          userStatus: "premium",
        },
      };
      const result = await usersCollection.updateOne(query, updateDoc);
      res.send(result);
    });
    // get all biodata
    app.get("/api/biodatas", async (req, res) => {
      const result = await biodatasCollection.find().sort({ age: 1 }).toArray();
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
      const query = { contactEmail: email };
      const result = await biodatasCollection.findOne(query);
      res.send(result);
    });
    // save success story 
    app.post('/api/marriage-story',async(req,res)=>{
      const successInfo = req.body;
      const result = await successStoryCollection.insertOne(successInfo)
      console.log(result)
      res.send(result);
    })
    // payment intent
    app.post("/api/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log(amount, price);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });
    // payment data save api
    app.post("/api/payment", async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);
      res.send(paymentResult);
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
        occupation: biodata.occupation,
        partnerHeight: biodata.partnerHeight,
        partnerWeight: biodata.partnerWeight,
        permanentDivision: biodata.permanentDivision,
        photoUrl: biodata.photoUrl,
        presentDivision: biodata.presentDivision,
        race: biodata.race,
        weight: biodata.weight,
        contactEmail: biodata.contactEmail,
        phoneNumber: biodata.phoneNumber,
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
          contactEmail: biodata.contactEmail,
          phoneNumber: biodata.phoneNumber,
        },
      };
      const result = await biodatasCollection.updateOne(filter, updateBiodata);
      res.send(result);
    });

    // add data to favourite collection
    app.post("/api/addToFavourite-collection", async (req, res) => {
      const biodata = req.body;
      const result = await favouritesCollection.insertOne(biodata);
      res.send(result);
    });
    // delete contact request
    app.delete("/api/contact-request/delete/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await paymentCollection.deleteOne(query);
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
