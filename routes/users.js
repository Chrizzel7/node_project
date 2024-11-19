var secrets = require('../config/secrets');

const User = require('../models/user');
const Task = require('../models/task');

module.exports = function (router) {

    var userRoute = router.route('/users');

    var userIdRoute = router.route('/users/:id');

    userRoute.get(async function (req, res) {
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
                return res.status(400).json({ error : "Query Format Error: " + error.message });
            }

            const users = await User.find(where).sort(sort).select(select).skip(skip).limit(limit);
            
            if (count) {
                res.status(200).json({ message: "OK", data: { count : users.length } });
            } else {
                res.status(200).json({ message: "OK", data: users });
            }

        } catch (error) {
            res.status(500).json({ error : error.message});
        }
    });

    userRoute.post(async function (req, res) {
        try {
            const user = req.body;
            const userCreated = await User.create(user);
            res.status(201).json({ message: "OK", data: userCreated });
        } catch (error) {
            if (error.name === 'ValidationError') {
                res.status(400).json({ error: error.message });
            } else {
                res.status(500).json({ error: error.message });
            }
        }
    })

    userIdRoute.get(async function (req, res) {
        try {

            let select = {};
            if (req.query.select)
                select = JSON.parse(req.query.select);

            const user = await User.findById(req.params.id).select(select);
            if (user)
                res.status(200).json({ message: "OK", data: user });
            else
                res.status(404).json({ error : "User not found"});
            
        } catch (error) {
            res.status(500).json({ error : error.message});
        }
    })

    userIdRoute.put(async function (req, res) {
        try {
            const newUser = req.body;

            const existingUser = await User.findById(req.params.id);
            if (!existingUser) {
                return res.status(404).json({ error: 'User not found' });
            }

            const updatedUser = await User.findByIdAndUpdate(req.params.id, newUser, { new: true, runValidators: true });

            if (existingUser.name !== updatedUser.name) {
                await Task.updateMany({ assignedUser : updatedUser._id }, { assignedUserName : updatedUser.name });
            }

            res.status(200).json({ message: "OK", data: updatedUser });
        } catch (error) {
            if (error.name === 'ValidationError') {
                res.status(400).json({ error: error.message });
            } else {
                res.status(500).json({ error: error.message });
            }
        }
    });

    userIdRoute.delete(async function (req, res) {
        try {
            const user = await User.findByIdAndDelete(req.params.id);
            if (!user) {
                return res.status(404).json({ error : 'User not found' });
            }
            await Task.updateMany({ assignedUser : user._id }, { assignedUser : "", assignedUserName : "unassigned"});
            res.status(200).json({ message: "OK", data: user });
        } catch (error) {
            res.status(500).json({ error : error.message });
        }
    })

    return router;
}
