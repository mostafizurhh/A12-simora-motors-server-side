const express = require('express');
const cors = require('cors');
require('dotenv').config()
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)


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

            if (user?.userCategory !== 'admin') {
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

        /* (READ) get all registered users data */
        app.get('/users', async (req, res) => {
            const query = {};
            const users = await usersCollection.find(query).toArray();
            res.send(users);
        })

        /* API to check if a user is admin or not */
        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            res.send({ isAdmin: user?.userCategory === 'admin' });
        })

        /* API to check if a user is Seller or not */
        app.get('/users/seller/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            res.send({ isSeller: user?.userCategory === 'Seller' });
        })

        /* get all sellers */
        app.get('/users/seller', async (req, res) => {
            const query = { userCategory: 'Seller' };
            const sellers = await usersCollection.find(query).toArray();
            res.send(sellers);
        })

        /* update buyer and seller status */
        app.put('/users/admin/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    status: 'verified'
                }
            };
            const result = await usersCollection.updateOne(filter, updatedDoc, options);
            res.send(result)
        })

        /* update userCategory for googleuser */
        app.patch('/users/admin/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            // const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    userCategory: 'Buyer'
                }
            };
            const result = await usersCollection.updateOne(filter, updatedDoc);
            res.send(result)
        })


        /* get all buyers */
        app.get('/users/buyer', async (req, res) => {
            const query = { userCategory: 'Buyer' };
            const buyer = await usersCollection.find(query).toArray();
            res.send(buyer);
        })

        /* (DELETE) delete a users data */
        app.delete('/users/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await usersCollection.deleteOne(query);
            res.send(result);
        })

        /*---------------CtaegoriesCollection-----------*/

        const categoriesCollection = client.db('simora-motors').collection('product-categories');
        // const categoriesCollection = client.db('simora-motors').collection('allcategories');

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
            res.send(result);
        });

        /*----------advertisedItemsCollection---------*/
        const advertisedItemsCollection = client.db('simora-motors').collection('advertisedItems');

        /* create advertised product collection */
        app.post('/advertised', async (req, res) => {
            const advertised = req.body;
            const result = await advertisedItemsCollection.insertOne(advertised);

            /* add a product dynamically in categoryCollection's products array. which structure is >> [array{object[array{object}]}]. 
            1. 1st filter data between categoriesCollection and advertisedItemsCollection using the field categoryType & advertised.type using findOne() method
            2. then apply if condition to find the match >> do a query same as filter 
            3. options{upsert:true} 
            4. updatedDoc ={$push > to add object/array {name of array/object (products) > {$each - takes an array as value which allows to push multiple values inside an array oor object > to update [{}]}}} 
            5. whole pattern >> updatedDoc={$push{products{$each[{}]}}}
            */

            const filter = {
                categoryType: advertised.type
            };
            const existingCategory = await categoriesCollection.findOne(filter)
            // console.log(existingCategory)
            if (existingCategory.categoryType === advertised.type) {
                const query = { categoryType: advertised.type };
                const options = { upsert: true }
                const updatedDoc = {
                    $push: {
                        products: {
                            $each: [
                                {
                                    _id: advertised._id,
                                    name: advertised.name,
                                    image: advertised.image,
                                    resale: advertised.resale,
                                    original: advertised.original,
                                    year: advertised.year,
                                    month: advertised.month,
                                    type: advertised.type,
                                    condition: advertised.condition,
                                    milage: advertised.milage,
                                    seller: advertised.seller,
                                    email: advertised.email,
                                    location: advertised.location,
                                    phone: advertised.phone,
                                    photoURL: advertised.photoURL,
                                    saleStatus: advertised.saleStatus,
                                    posted: new Date()
                                }
                            ]
                        }
                    }
                }
                const updatedResult = await categoriesCollection.updateOne(query, updatedDoc, options)
                // console.log('category collection', updatedResult)
            }
            res.send(result);
        })

        /* show advertised items on home page */
        app.get('/advertisedItems', async (req, res) => {
            const query = {};
            const cursor = advertisedItemsCollection.find(query).sort({ date: -1 });
            const result = await cursor.toArray();
            res.send(result);
        })

        /* get specific user's advertised items and verify JWT */
        app.get('/advertised', verifyJWT, async (req, res) => {
            const email = req.query.email;
            // console.log(email);
            const decodedEmail = req.decoded.email;
            // console.log(decodedEmail)
            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'Forbidden Access' });
            }

            const query = { email: email };
            const result = await advertisedItemsCollection.find(query).sort({ date: -1 }).toArray();
            res.send(result)
        });

        /* get single advertised data */
        app.get('/advertised/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await advertisedItemsCollection.findOne(query);
            res.send(result)
        })

        /* delete a advertised item */
        app.delete('/advertised/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            console.log(query)
            const result = await advertisedItemsCollection.deleteOne(query);
            res.send(result);
        })

        /* update product's currentSaleStatus */
        app.put('/advertised/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const options = { upsert: true }
            const updatedDoc = {
                $set: {
                    saleStatus: 'Sold'
                }
            }
            const result = await advertisedItemsCollection.updateOne(query, updatedDoc, options);
            res.send(result);
        })

        /* change product's saleStatus*/
        app.patch('/advertised/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const options = { upsert: true }
            const updatedDoc = {
                $set: {
                    saleStatus: 'Available'
                }
            }
            const result = await advertisedItemsCollection.updateOne(query, updatedDoc, options);
            res.send(result);
        })

        /*---------------bookingCollection-----------*/

        const bookingCollection = client.db('simora-motors').collection('bookings');

        /* create booking collection */
        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            const query = {
                name: booking.name,
                email: booking.email
            }
            const alreadyBooked = await bookingCollection.find(query).toArray();
            if (alreadyBooked.length) {
                const message = `You already booked this item.`;
                return res.send({ acknowledged: false, message });
            }
            const result = await bookingCollection.insertOne(booking);
            res.send(result)
        })

        /* get specific user's booking and verify JWT */
        app.get('/bookings', verifyJWT, async (req, res) => {
            const email = req.query.email;
            //console.log('email', email);
            const decodedEmail = req.decoded.email;
            //console.log('decoded', decodedEmail)
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

        /* delete a booking data */
        app.delete('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await bookingCollection.deleteOne(query);
            res.send(result);
        })

        /*---------------paymentCollection-----------*/
        const reportedItemCollection = client.db('simora-motors').collection('reporteditems');

        /* create reported items collection from client side */
        app.post('/reporteditems', async (req, res) => {
            const reported = req.body;
            const result = await reportedItemCollection.insertOne(reported);
            res.send(result);
        })

        /* get all reported items */
        app.get('/reporteditems', async (req, res) => {
            const query = {};
            const result = await reportedItemCollection.find(query).toArray();
            res.send(result);
        })

        /* get a reported items */
        app.get('/reporteditems/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await reportedItemCollection.findOne(query);
            res.send(result);
        })

        /* delete a reported items */
        app.delete('/reporteditems/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await reportedItemCollection.deleteOne(query);
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
                    transactionId: payment.transactionId,
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



// /*-------------diselcarsCollection-----------*/
        // const diselcarsCollection = client.db('simora-motors').collection('diselcars')

        // app.get('/diselcars', async (req, res) => {
        //     const query = {}
        //     const result = await diselcarsCollection.find(query).toArray()
        //     res.send(result)
        // })


/*---------------productsCollection-----------*/

        // const productsCollection = client.db('simora-motors').collection('all-products');

        // /* (READ) get all product data */
        // app.get('/allproducts', async (req, res) => {
        //     const query = {};
        //     const result = await productsCollection.find(query).toArray();
        //     res.send(result);
        // });

        // app.get('/allproducts/:id', async (req, res) => {
        //     const id = req.params.id;
        //     const query = { _id: ObjectId(id) };
        //     const result = await productsCollection.findOne(query);
        //     res.send(result);
        // })

        // app.get('/allproducts/disel', async (req, res) => {
        //     const query = { type: 'Disel' };
        //     const result = await productsCollection.find(query).toArray();
        //     res.send(result);
        // })