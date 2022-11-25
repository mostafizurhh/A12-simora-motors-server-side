const express = require('express');
const cors = require('cors');
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


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


/* mongodb connection */
require('dotenv').config()
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.mniec4l.mongodb.net/?retryWrites=true&w=majority`
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

/* mongodb CRUD operation */
async function run() {
    try {
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
    }
    finally {

    }
}
run().catch(console.log)