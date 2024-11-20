var secrets = require('../config/secrets');

const User = require('../models/user');
const Task = require('../models/task');

module.exports = function (router) {

    var taskRoute = router.route('/tasks');

    var taskIdRoute = router.route('/tasks/:id');

    taskRoute.get(async function (req, res) {
        try {

            let where = {};
            let sort = {};
            let select = {};
            let skip = 0;
            let limit = 0;
            let count = false;

            try {
                
                if (req.query.where)
                    where = JSON.parse(req.query.where);

                if (req.query.sort)
                    sort = JSON.parse(req.query.sort);

                if (req.query.select)
                    select = JSON.parse(req.query.select);

                if (req.query.skip)
                    skip = parseInt(req.query.skip, 10);

                if (req.query.limit)
                    limit = parseInt(req.query.limit, 10);

                if (req.query.count)
                    count = req.query.count.toLowerCase() === 'true';

                if (skip < 0 || limit < 0)
                    return res.status(400).json({ error : "skip and limit cannot be negative" });

            } catch (error) {
                return res.status(400).json({ error : "Query Format Error: " + error.message})
            }

            const tasks = await Task.find(where).sort(sort).select(select).skip(skip).limit(limit);
            
            if (count) {
                res.status(200).json({ message: "OK", data: { count: tasks.length } });
            } else {
                res.status(200).json({ message: "OK", data: tasks });
            }

        } catch (error) {
            res.status(500).json({ error : error.message });
        }
    })

    taskRoute.post(async function (req, res) {
        try {
            const newTask = req.body;

            if (newTask.assignedUser && newTask.assignedUser !== "") {
                const user = await User.findById(newTask.assignedUser);
                if (!user) {
                    return res.status(404).json({ error: "Assigned user not found" });
                }
                newTask.assignedUserName = user.name;
            }

            const taskCreated = await Task.create(newTask);

            if (taskCreated.assignedUser !== "") {
                const user = await User.findById(taskCreated.assignedUser);
                if (!user.pendingTasks.includes(taskCreated.assignedUser)) {
                    user.pendingTasks.push(taskCreated.assignedUser);
                    await user.save();
                }
            }
            res.status(201).json({ message: "OK", data: taskCreated});
        } catch (error) {
            if (error.name === 'ValidationError') {
                res.status(400).json({ error : error.message });
            } else {
                res.status(500).json({ error : error.message });
            }
        }
    })

    taskIdRoute.get(async function (req, res) {
        try {

            let select = {}

            if (req.query.select)
                select = JSON.parse(req.query.select);
            
            const task = await Task.findById(req.params.id).select(select);

            if (task)
                res.status(200).json({ message: "OK", data: task});
            else
                res.status(404).json({ error : 'Task not found' });

        } catch (error) {
            res.status(500).json({ error : error.message });
        }
    })

    taskIdRoute.put(async function (req, res) {
        try {

            const newTask = req.body;

            const existingTask = await Task.findById(req.params.id);
            if (!existingTask) {
                return res.status(404).json({ error: 'Task not found' });
            }

            const updatedTask = await Task.findByIdAndUpdate(req.params.id, newTask, { new: true, runValidators: true });

            if (updatedTask.assignedUser !== existingTask.assignedUser) {
                if (existingTask.assignedUser !== "") {
                    await User.findByIdAndUpdate( existingTask.assignedUser, { $pull: { pendingTasks: existingTask._id } }, { new: true });
                }
                if (updatedTask.assignedUser !== "") {
                    await User.findByIdAndUpdate( updatedTask.assignedUser, { $addToSet: { pendingTasks: updatedTask._id } }, { new: true});
                }
            }

            res.status(200).json({ message: "OK", data: updatedTask});

        } catch (error) {
            if (error.name === 'ValidationError')
                res.status(400).json({ error : error.message });
            else
                res.status(500).json({ error : error.message });
        }
    })

    taskIdRoute.delete(async function (req, res) {
        try {

            const deletedTask = await Task.findByIdAndDelete(req.params.id);

            if (!deletedTask)
                return res.status(404).json({ error : "Task not found" });
            
            const updateResult = await User.updateMany({pendingTasks : deletedTask._id}, {$pull: {pendingTasks: deletedTask._id}});

            console.log(`Deleted task: ${deletedTask._id}`);
            console.log(`Updated users: ${updateResult.modifiedCount}`);    

            res.status(200).json({ message: "OK", data: deletedTask});

        } catch (error) {
            res.status(500).json({ error : error.message });
        }
    })

    return router;
}