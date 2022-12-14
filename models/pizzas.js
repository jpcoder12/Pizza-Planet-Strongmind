const mongoose = require('mongoose')
const ObjectId = mongoose.Schema.Types.ObjectId

// Create the results moodel
let pizzasModel = mongoose.model('pizzas', {
    name: {
        type: String,
        required: true
    },
    toppings: [{
        type: ObjectId,
        ref: 'toppings',
        required: true
    }],
    description: {
        type: String,
        required: true
    },
    price: {
        type: String,
        required: true
    },
    img: {
        type: String,
    },
    users: {
        type: ObjectId,
        ref: 'users',
    },
})

module.exports = pizzasModel