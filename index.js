/*======================================
 bacic set up for express server
=======================================*/
const express = require('express');
const app = express();
const cors = require('cors');
const port = process.env.PORT || 5000;
/*======================================
 this code is for .env file set up
=======================================*/
require('dotenv').config();
/*======================================
 This code is for jsonwebtoken set up
=======================================*/
const jwt = require('jsonwebtoken');
/*======================================
 this code is for stripe payment method
=======================================*/
const stripe = require('stripe')(process.env.PAYMENT_KEY);
/*======================================
 All middleware is start from here
=======================================*/
app.use(cors());
app.use(express.json());

//For verify user middleware
const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if(!authorization){
        return res.status(401).send({error: true, message: 'Unauthorized Access'})
    };
    //bearer token
    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.USER_TOKEN, (err, decoded) => {
        if(err){
            return res.status(401).send({error: true, message: 'Unauthorized Access'})
        }
        req.decoded = decoded;
        next();
    })
}
/*======================================
 mongodb connection code is start from here
=======================================*/

const { MongoClient, ServerApiVersion,ObjectId } = require('mongodb');
//this uri is changleable project by project
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.lddc2vn.mongodb.net/?retryWrites=true&w=majority`;


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

/*======================================
 All mongodb collection are here
=======================================*/
const usersCollection = client.db("server").collection("users");
const blogsCollection = client.db("server").collection("blogs");
const paymentsCollection = client.db("server").collection("payments");
const projectsCollection = client.db("server").collection("projects");

app.get('/', (req,res) => {
    const result = 'Server is Running';
    res.send(result);
})

/*======================================
 All users related function are here
=======================================*/
//for generating json token
app.post('/jwt',(req,res) => {
 const user = req.body;
 const token = jwt.sign(user, process.env.USER_TOKEN, {expiresIn: '12h'})
 res.send({token})
})

//this function is for verify admin
const verifyAdmin = async(req,res,next) => {
    const email = req.decoded.email;
    const filter = {email: email};
    const user = await usersCollection.findOne(filter);
    if(user?.role !== 'admin'){
        return res.status(403).send({error: true, message: 'Forbidden User'})
    }
    next();
}

 /*
     * 0. do not show secure links to those who should not see the links
     * 1. use jwt token: verifyJWT
     * 2. use verifyAdmin middleware
*/

/*======================================
 users related api
=======================================*/
app.get('/users', async(req,res) => {
    const result = await usersCollection.find().toArray();
    res.send(result);
})

app.post('/users', async(req,res) => {
    const user = req.body;
    const filter = {email: user.email};
    const existingUser = await usersCollection.findOne(filter);
    if(existingUser){
        return res.status({message: 'User Already exists'})
    }
    const result = await usersCollection.insertOne(user);
    res.send(result);
})



    /* 
     security layer: verifyJWT
     email same
     check admin
    */

     app.delete('/user/:id', async(req,res) => {
        const id = req.params.id;
        const filter = {_id: new ObjectId(id)};
        const result = await usersCollection.deleteOne(filter);
        res.send(result);
     })

     app.get('/users/admin/:email', verifyJWT, async(req,res) => {
        const email = req.params.email;
        if(req.decoded.email !== email){
            res.send({admin: false})
        }
        const filter = {email : email};
        const user = await usersCollection.findOne(filter);
        const result = {admin: user?.role === 'admin'};
        res.send(result);
     })

     app.get('/users/moderator/:email', verifyJWT, async(req,res) => {
        const email = req.params.email;
        if(req.decoded.email !== email){
            res.send({moderator: false})
        }
        const filter = {email : email};
        const user = await usersCollection.findOne(filter);
        const result = {moderator: user?.role === 'moderator'};
        res.send(result);
     })

     app.patch('/users/moderator/:id', async(req,res) => {
        const id = req.params.id;
        const filter = {_id: new ObjectId(id)};
        const updateInfo = {
            $set: {
                role: 'moderator'
            }
        };
        const result = await usersCollection.updateOne(filter, updateInfo);
        res.send(result);
     })
     app.patch('/users/admin/:id', async(req,res) => {
        const id = req.params.id;
        const filter = {_id: new ObjectId(id)};
        const updateInfo = {
            $set: {
                role: 'admin'
            }
        };
        const result = await usersCollection.updateOne(filter, updateInfo);
        res.send(result);
     })



/*======================================
 blogs related api
=======================================*/

app.get('/blogs', async (req, res) => {
    const result = await blogsCollection.find().toArray();
    res.send(result);
  })
app.get('/blogs/:id', async (req, res) => {
    const id = req.params.id;
    const filter = {_id: new ObjectId(id)};
    const result = await blogsCollection.findOne(filter);
    res.send(result);
  })

  app.post('/blogs', async (req, res) => {
    const newBlog = req.body;
    const result = await blogsCollection.insertOne(newBlog)
    res.send(result);
  })

  app.delete('/blog/:id', verifyJWT, verifyAdmin, async (req, res) => {
    const id = req.params.id;
    const filter = { _id: new ObjectId(id) }
    const result = await blogsCollection.deleteOne(filter);
    res.send(result);
  })

  app.put('/blog/:id', async(req,res) => {
    // id for uniquely identification
    const id = req.params.id;
    // user for take info to update old info
    const user = req.body;
    const filter = {_id: new ObjectId(id)};
    const options = {upsert: true};
    const updateInfo = {
        $set: {
            name: user.name,
            description: user.description
        }
    };
    const result = await blogsCollection.updateOne(filter,updateInfo,options);
    res.send(result);
})
/*======================================
 projects related api
=======================================*/

app.get('/projects', async (req, res) => {
    try {
      const result = await projectsCollection.find().sort({ _id: -1 }).toArray();
      res.send(result);
    } catch (err) {
      console.error('Error:', err);
      res.status(500).send('An error occurred');
    }
  });
  

  app.post('/projects', async (req, res) => {
    const newProject = req.body;
    const result = await projectsCollection.insertOne(newProject)
    res.send(result);
  })

  app.delete('/project/:id', verifyJWT, verifyAdmin, async (req, res) => {
    const id = req.params.id;
    const filter = { _id: new ObjectId(id) }
    const result = await projectsCollection.deleteOne(filter);
    res.send(result);
  })

  app.put('/project/:id', async(req,res) => {
    // id for uniquely identification
    const id = req.params.id;
    // user for take info to update old info
    const user = req.body;
    const filter = {_id: new ObjectId(id)};
    const options = {upsert: true};
    const updateInfo = {
        $set: {
            name: user.name,
            description: user.description
        }
    };
    const result = await projectsCollection.updateOne(filter,updateInfo,options);
    res.send(result);
})


/*======================================
 Payment related function and api
=======================================*/
//create a payment intent for take permisson from the user to take money

app.post('/create-payment-intent', verifyJWT, async(req,res) => {
    const {price} = req.body;
    const amount = parseInt(price * 100);
    const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
    });
    res.send({
        clientSecret: paymentIntent.client_secret
    })
})

//payment related api
app.post('/payments', verifyJWT, async(req, res) => {
    const payment = req.body;
    const insertPaymentInfo = await paymentsCollection.insertOne(payment);
    const filter = {_id: {$in: payment.cartItems.map(id => new ObjectId(id))}};
    const deleteInfo = await cartCollection.deleteMany(filter);
    res.send({insertPaymentInfo, deleteInfo});
})
/*======================================
 Admin stats , all admin collection info 
 which are mainly used in admin dashboard
=======================================*/
app.get('/admin-stats',verifyJWT, verifyAdmin,  async(req,res) => {
    const users = await usersCollection.estimatedDocumentCount();
    const prjects = await projectsCollection.estimatedDocumentCount();
    const payments = await paymentsCollection.find().toArray();
    const revenue = payments.reduce((sum, payment) => sum + payment.price, 0);

    res.send({
        users,
        products,
        orders,
        revenue
    })
})


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

/*======================================
 Basic setup last code
=======================================*/
//server console
app.listen(port, ()=>{
    console.log(`Server is running on port ${port}`)
})
