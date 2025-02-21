require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 4000;
const morgan = require('morgan');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const corsOption = {
    origin: process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : '*',
    credentials: true,
    methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionSuccessStatus: 200,
};


app.use(cors(corsOption));
app.use(express.json());
app.use(morgan('dev'));


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.yt5iw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
        // await client.connect();
        const taskCollection = client.db('taskManagerDB').collection('tasks');


        // ✅ Get all tasks grouped by category
        app.get("/tasks", async (req, res) => {
            try {
                const tasks = await taskCollection.find().toArray();
                const groupedTasks = {
                    todo: tasks.filter((t) => t.category === "todo"),
                    inProgress: tasks.filter((t) => t.category === "inProgress"),
                    done: tasks.filter((t) => t.category === "done"),
                };
                res.json(groupedTasks);
            } catch (error) {
                res.status(500).send({ error: "Failed to fetch tasks" });
            }
        });

        // ✅ Add a new task
        app.post("/tasks", async (req, res) => {
            try {
                const { title, description, category } = req.body;
                // Validate title length
                if (!title || title.length > 50) {
                    return res.status(400).send({ error: "Title must be less than 50 characters" });
                }
                // Validate description length
                if (description && description.length > 200) {
                    return res.status(400).send({ error: "Description must be less than 200 characters" });
                }
                // Validate category
                if (!["todo", "inProgress", "done"].includes(category)) {
                    return res.status(400).send({ error: "Invalid category" });
                }
                const newTask = {
                    title,
                    description,
                    category,
                    timestamp: new Date(),
                };
                const result = await taskCollection.insertOne(newTask);
                res.status(201).json({ ...newTask, _id: result.insertedId });
            } catch (error) {
                res.status(500).send({ error: "Failed to add task" });
            }
        });

        // ✅ Update task category (for drag-and-drop)
        app.put("/tasks/:id", async (req, res) => {
            try {
                const id = req.params.id;
                const { category } = req.body;

                // Validate category
                if (!["todo", "inProgress", "done"].includes(category)) {
                    return res.status(400).send({ error: "Invalid category" });
                }

                const updatedTask = { category };

                const result = await taskCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: updatedTask }
                );

                if (result.modifiedCount === 0) {
                    return res.status(404).send({ error: "Task not found" });
                }

                res.send({ message: "Task category updated successfully" });
            } catch (error) {
                res.status(500).send({ error: "Failed to update task category" });
            }
        });

        // ✅ Update task (for editing)
        app.put("/tasks/update/:id", async (req, res) => {
            try {
                const id = req.params.id;
                const { title, description, category } = req.body;

                // Validate title length
                if (title && title.length > 50) {
                    return res.status(400).send({ error: "Title must be less than 50 characters" });
                }

                // Validate category
                if (category && !["todo", "inProgress", "done"].includes(category)) {
                    return res.status(400).send({ error: "Invalid category" });
                }

                const updatedData = {};
                if (title) updatedData.title = title;
                if (description) updatedData.description = description;
                if (category) updatedData.category = category;

                const result = await taskCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: updatedData }
                );

                if (result.modifiedCount === 0) {
                    return res.status(404).send({ error: "Task not found" });
                }

                res.send({ message: "Task updated successfully" });
            } catch (error) {
                res.status(500).send({ error: "Failed to update task" });
            }
        });

        // ✅ Delete task
        app.delete("/tasks/:id", async (req, res) => {
            try {
                const id = req.params.id;
                const result = await taskCollection.deleteOne({ _id: new ObjectId(id) });

                if (result.deletedCount === 0) {
                    return res.status(404).send({ error: "Task not found" });
                }

                res.send({ message: "Task deleted successfully" });
            } catch (error) {
                res.status(500).send({ error: "Failed to delete task" });
            }
        });



        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', async (req, res) => {
    res.send('Hello World...');
});

app.listen(port, () => {
    console.log(`The server is running on port ${port}`);
});
