const express = require('express');
const cors = require('cors');
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
// const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)
const stripe = require("stripe")("sk_test_51M5xTOEjKmhiTrYBMHYiby5C3o2rP0RApy4qROYcuPMbgY8V97lON3nzB1No7YQRkn4uhxR3T4byVuwRPOyk7yuc000dfIMeod")


const app = express();

/* middleware */
app.use(cors());
app.use(express.json());


app.get('/', async (req, res) => {
    res.send('Server is running...........')
})

app.listen(port, () => {
    console.log(`Server is running on port ${port}`)
})

/*---------------JWT Verification-----------*/
const jwt = require('jsonwebtoken');
function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).send('Unauthorized Access')
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden Access' })
        }
        req.decoded = decoded;
        next()
    })
}

/* mongodb connection */
require('dotenv').config()
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.mniec4l.mongodb.net/?retryWrites=true&w=majority`
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

/* mongodb CRUD operation */
async function run() {
    try {

        /*---------------Admin Verification-----------*/
        const verifyAdmin = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);

            if (user?.role !== 'admin') {
                return res.status(401).send({ message: 'Unauthorized Access' })
            }
            next()
        }

        /*---------------Seller Verification-----------*/
        const verifySeller = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);

            if (user?.role !== 'admin' || user?.userCategory !== 'Seller') {
                return res.status(401).send({ message: 'Unauthorized Access' })
            }
            next()
        }

        /*---------------JWT Verification-----------*

        /* create JWT token API from client side info */
        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            // console.log(user)
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '7d' });
                return res.send({ accessToken: token })
            }
            res.status(403).send({ token: '' })
        })


        /*---------------usersCollection-----------*/

        const usersCollection = client.db('simora-motors').collection('users');

        /* create users collection from client side info */
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.send(result);
        })

        /* API to check if a user is admin or not */
        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            res.send({ isAdmin: user?.role === 'admin' });
        })

        /* API to check if a user is Seller or not */
        app.get('/users/seller/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            res.send({ isSeller: user?.userCategory === 'Seller' });
        })

        /*---------------CtaegoriesCollection-----------*/

        const categoriesCollection = client.db('simora-motors').collection('product-categories');

        /* (READ) get all product categories */
        app.get('/allcategories', async (req, res) => {
            const query = {};
            const result = await categoriesCollection.find(query).toArray();
            res.send(result);
        });

        /* get individual category products */
        app.get('/allcategories/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await categoriesCollection.findOne(query);

            /* aggrigate */
            // const date = req.query.date;
            // const booking

            res.send(result);
        });


        /*---------------productsCollection-----------*/

        const productsCollection = client.db('simora-motors').collection('all-products');

        /* (READ) get all product data */
        app.get('/allproducts', async (req, res) => {
            const query = {};
            const result = await productsCollection.find(query).toArray();
            res.send(result);
        });

        app.get('/allproducts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await productsCollection.findOne(query);
            res.send(result);
        })

        /*---------------bookingCollection-----------*/

        const bookingCollection = client.db('simora-motors').collection('bookings');

        /* create booking collection */
        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            const result = await bookingCollection.insertOne(booking);
            res.send(result)
        })

        /* get specific user's booking and verify JWT */
        app.get('/bookings', verifyJWT, async (req, res) => {
            const email = req.query.email;
            // console.log(email);
            const decodedEmail = req.decoded.email;
            // console.log(decodedEmail)
            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'Forbidden Access' });
            }

            const query = { email: email };
            const result = await bookingCollection.find(query).toArray();
            res.send(result)
        });

        /* get single booking info of a service */
        app.get('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await bookingCollection.findOne(query);
            res.send(result);
        })

        /*---------------paymentCollection-----------*/

        /* create Payment collection to save users payment info */
        const usersPaymentCollection = client.db('simora-motors').collection('userPayment');

        /* crete API for stripe */
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const booking = req.body;
            const price = booking.price;
            const amount = price * 100;

            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                "payment_method_types": [
                    "card"
                ]
            });
            res.send({
                clientSecret: paymentIntent.client_secret
            });
        })

        app.post('/userPayments', async (req, res) => {
            const payment = req.body;
            const result = await usersPaymentCollection.insertOne(payment);
            const id = payment.bookingId;
            const query = { _id: ObjectId(id) }
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }
            const updatedResult = await bookingCollection.updateOne(query, updatedDoc);
            res.send(result)
        })

    }
    finally {

    }
}
run().catch(console.log)