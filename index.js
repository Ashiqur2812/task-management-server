require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const morgan = require("morgan");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 4000;

const app = express();
const server = http.createServer(app);

// ✅ Define CORS options 
const corsOptions = {
    origin: [
        "http://localhost:5173",
        "https://task-management-client-767h.vercel.app",
        "https://task-management-server-wheat-gamma.vercel.app",
    ],
    methods: ["GET", "POST", "DELETE", "PUT", "PATCH"],
    credentials: true,
};

// ✅ Use CORS options
app.use(cors(corsOptions));
app.use(express.json());
app.use(morgan("dev"));

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.yt5iw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

async function run() {
    try {
        const taskCollection = client.db("taskManagerDB").collection("tasks");
        const activityLogCollection = client.db("taskManagerDB").collection("activityLogs");

        // WebSocket connection
        io.on("connection", (socket) => {
            console.log("A client connected");

            socket.on("disconnect", () => {
                console.log("A client disconnected");
            });
        });

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
                const { title, description, category, dueDate } = req.body;

                // Validate title
                if (!title || title.trim() === "" || title.length > 50) {
                    return res.status(400).send({ error: "Title must be between 1-50 characters" });
                }

                // Validate description
                if (description && description.length > 200) {
                    return res.status(400).send({ error: "Description must be less than 200 characters" });
                }

                // Validate category
                if (!["todo", "inProgress", "done"].includes(category)) {
                    return res.status(400).send({ error: "Invalid category" });
                }

                // Validate dueDate
                if (dueDate && new Date(dueDate) < new Date()) {
                    return res.status(400).send({ error: "Due date cannot be in the past" });
                }

                const newTask = {
                    title,
                    description: description || "",
                    category,
                    dueDate: dueDate || null,
                    timestamp: new Date(),
                };

                const result = await taskCollection.insertOne(newTask);

                // Log activity
                await activityLogCollection.insertOne({
                    message: `Task "${title}" added.`,
                    timestamp: new Date(),
                });

                io.emit("task-updated");
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

                const result = await taskCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { category } }
                );

                if (result.modifiedCount === 0) {
                    return res.status(404).send({ error: "Task not found" });
                }

                // Log activity
                const task = await taskCollection.findOne({ _id: new ObjectId(id) });
                await activityLogCollection.insertOne({
                    message: `Task "${task.title}" moved to ${category}.`,
                    timestamp: new Date(),
                });

                io.emit("task-updated");
                res.send({ message: "Task category updated successfully" });
            } catch (error) {
                res.status(500).send({ error: "Failed to update task category" });
            }
        });

        // ✅ Update task (for editing)
        app.put("/tasks/update/:id", async (req, res) => {
            try {
                const id = req.params.id;
                const { title, description, category, dueDate } = req.body;

                // Validate title
                if (title && title.length > 50) {
                    return res.status(400).send({ error: "Title must be less than 50 characters" });
                }

                // Validate category
                if (category && !["todo", "inProgress", "done"].includes(category)) {
                    return res.status(400).send({ error: "Invalid category" });
                }

                // Validate dueDate
                if (dueDate && new Date(dueDate) < new Date()) {
                    return res.status(400).send({ error: "Due date cannot be in the past" });
                }

                const updatedData = {};
                if (title) updatedData.title = title;
                if (description) updatedData.description = description;
                if (category) updatedData.category = category;
                if (dueDate) updatedData.dueDate = dueDate;

                const result = await taskCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: updatedData }
                );

                if (result.modifiedCount === 0) {
                    return res.status(404).send({ error: "Task not found" });
                }

                // Log activity
                const task = await taskCollection.findOne({ _id: new ObjectId(id) });
                await activityLogCollection.insertOne({
                    message: `Task "${task.title}" updated.`,
                    timestamp: new Date(),
                });

                io.emit("task-updated");
                res.send({ message: "Task updated successfully" });
            } catch (error) {
                res.status(500).send({ error: "Failed to update task" });
            }
        });

        // ✅ Delete task
        app.delete("/tasks/:id", async (req, res) => {
            try {
                const id = req.params.id;
                const task = await taskCollection.findOne({ _id: new ObjectId(id) });

                const result = await taskCollection.deleteOne({ _id: new ObjectId(id) });

                if (result.deletedCount === 0) {
                    return res.status(404).send({ error: "Task not found" });
                }

                // Log activity
                await activityLogCollection.insertOne({
                    message: `Task "${task.title}" deleted.`,
                    timestamp: new Date(),
                });

                io.emit("task-updated");
                res.send({ message: "Task deleted successfully" });
            } catch (error) {
                res.status(500).send({ error: "Failed to delete task" });
            }
        });

        // ✅ Get activity log
        app.get("/activity-log", async (req, res) => {
            try {
                const logs = await activityLogCollection.find().sort({ timestamp: -1 }).toArray();
                res.json(logs);
            } catch (error) {
                res.status(500).send({ error: "Failed to fetch activity log" });
            }
        });

        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get("/", async (req, res) => {
    res.send("Hello World...");
});

server.listen(port, () => {
    console.log(`The server is running on port ${port}`);
});