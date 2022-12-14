const express = require('express')
const router = express.Router()
const Toppings = require('../models/toppings')
const Pizzas = require('../models/pizzas')
const ErrorMessage = require('../Errors')

const setToppingImage = (type) => {
    if (type == 'Sauce'){
        return './images/tomato.png'
    } else if (type == 'Cheese'){
        return './images/shredded-cheese.png'
    } else if (type == 'Veggies') {
        return './images/mushrooms-generic.png'
    } else if (type == 'Meat'){
        return './images/pepperoni.png'
    } else if (type == 'Garnish'){
        return './images/basil.png'
    }
}
const setPizzaImg = () => {
    // returns a random pizza image path. 
    let randint = Math.floor(Math.random() * (6 - 1) + 1)
    let imagePaths = ['./images/pizza-cheese.png', './images/pizza-meaty.png', './images/pizza-pep-veg.webp', './images/pizza-tomatobasil.png', './images/pizza-vegetarian.png']
    let selectedImg = ''
    if (randint == 1){
        selectedImg = imagePaths[0]
    } else if (randint == 2){
        selectedImg = imagePaths[1]
    } else if (randint == 3){
        selectedImg = imagePaths[2]
    } else if (randint == 4){
        selectedImg = imagePaths[3]
    } else {
        selectedImg = imagePaths[4]
    }
    return selectedImg
}
// render the create a topping page for Owner view
router.get('/', async (req, res, next) => {
    try {
        // this is mostly just for toppings. 
        if (req.isAuthenticated()){
            // const pizzas = await Pizzas.find()
            if (req.user.permissions == 'Owner'){
                // Owner needs read+write access to toppings and read access to pizzas.
                res.render('create', {user: req.user, title: 'Create'})
            }
        } else {
            res.redirect('/create')
        }
    } catch(err){
        next(ErrorMessage.badRequest(err))
    }
})
// Creating a new topping
router.post('/submit-topping', async (req, res, next) => {
    try{
        // Change spaces to dashes and remove trailing spaces while we're at it
        req.body.name = req.body.name.replace(/\s+$/, '').replace(/ /g, '-')
        req.body.price = Number(req.body.price).toFixed(2)
        const newTopping = {
            name: req.body.name,
            type: req.body.type,
            price: req.body.price,
            img: setToppingImage(req.body.type),
            users: req.user.id
        }
            // No duplicate toppings
        let duplicate = await Toppings.findOne({
            name: newTopping.name
        })
        if (duplicate){
            throw new Error('A topping by that name already exists')
        } else {
            await Toppings.create(newTopping)
            res.redirect('..')
        }
    } catch(err) {
        next(ErrorMessage.badRequest(err))
    }
})
// Creating a new pizza
router.post('/submit-pizza', async (req, res, next) => {
    try{
        // These lines prepare the body so that it's ready to be sent to the db
        req.body.name = req.body.name.trim() // removes trailing whitespace
        let formToppings = req.body.toppings.split(',') // the toppings come in as one string, but each word is separated by commas
        formToppings.sort() 
        let toppings = await Toppings.find()
        let allPizzas = await Pizzas.find().populate('toppings')
        let duplicateByName = false
        allPizzas.forEach(pizza => {
            let duplicateCount = 0
            if (req.body.name.toLowerCase() == pizza.name.toLowerCase()){
                duplicateByName = true
            }
            pizza.toppings.sort((a, b) => a.name > b.name ? 1 : -1)
            // if the toppings are the same (length and names), throw an error. 
            if (pizza.toppings.length == formToppings.length){
                for (let i = 0; i<pizza.toppings.length; i++){
                    if (pizza.toppings[i].name == formToppings[i]){
                        duplicateCount += 1
                        continue
                    } else {
                        break
                    }
                }
            }
            if (duplicateCount == formToppings.length){
                throw new Error('There is already a pizza with this combination of toppings')
            }
        })
        if (duplicateByName){
            throw new Error('A pizza by that name already exists.')
        }
        let price = 0
        const newPizza = {
            name: req.body.name,
            description: req.body.description,
            img: setPizzaImg(),
            users: req.user.id,
            toppings: formToppings.map(topping => {
                let id 
                toppings.forEach(obj => {
                    if (obj.name == topping){
                        id = obj.id
                        price += Number(obj.price)
                    }})
                return id}),
            price: (price + 5.00).toFixed(2)}
        // if duplicate, throw err, else add to newPizza to db. 
        await Pizzas.create(newPizza)
        res.redirect("..")
    } catch(err) {
        next(ErrorMessage.badRequest(err))
    }
})
// Update a topping's data
router.post('/update/:id', async (req, res, next) => {
    // find topping and check to see if it exists. If it does, hydrate the create page with the data of that topping
    // the topping cannot be a duplicate of an entirely different topping (by id)
    try{
        req.body.price = Number(req.body.price).toFixed(2)
        foundTopping = await Toppings.findById(req.body.id)
        if (!foundTopping) {
            throw new Error('The topping no longer exists')
        } else {
            let duplicateByName = await Toppings.findOne({
                name: req.body.name
            })
            if (duplicateByName){
                if (duplicateByName.id != req.params.id) {
                    throw new Error('A topping by that name already exists')
                }
            }
            // Fill spaces with dashes
            req.body.name = req.body.name.replace(/ /g, '-')
            await Toppings.findByIdAndUpdate(req.params.id, {
                name: req.body.name,
                type: req.body.type,
                price: req.body.price,
                img: setToppingImage(req.body.type)
            })  
            res.redirect('back')
        
        }
    } catch(err) {
        next(ErrorMessage.badRequest(err))
    }
})
// update a pizza's data
router.post('/update-pizza/:id', async (req, res, next) => {
    try {
        req.body.name = req.body.name.trim() // removes trailing whitespace
        req.body.toppings = req.body.toppings.split(',')
        req.body.id = req.body.id[0]
        req.body.toppings.sort()
        let allPizzas = await Pizzas.find().populate('toppings')
        let allToppings = await Toppings.find()
        let price = 0
        let foundPizza = false // for finding the pizza in the db to update
        // find the pizza, but also sort the toppings of each one so we can find duplicates by matching, as well as finding duplicate by name
        allPizzas.forEach(pizza => {
            let duplicateCount = 0
            if (pizza.id == req.params.id){
                foundPizza = pizza
            }
            if (req.body.name.toLowerCase() == pizza.name.toLowerCase()){
                if (pizza.id != req.params.id){
                    throw new Error('A pizza by this name already exists. You cannot edit a pizza to be the same name.')
                }
            }
            pizza.toppings.sort((a, b) => a.name > b.name ? 1 : -1)
                // if the pizza is not this one and the toppings are the same (length and names), throw an error. 
                if (pizza.toppings.length == req.body.toppings.length && req.params.id != pizza.id){
                    for (let i = 0; i<pizza.toppings.length; i++){
                        if (pizza.toppings[i].name == req.body.toppings[i]){
                            duplicateCount += 1
                            continue
                        } else {
                            duplicateToppings = false
                            break
                        }
                    }
                }
                if (duplicateCount == req.body.toppings.length){
                    throw new Error('There is already a pizza with this combination of toppings.')
                }
        })
        if (!foundPizza) {
            throw new Error('This pizza no longer exists')
        } else {
            let duplicateByName = allPizzas.find(pizza => pizza.name == req.body.name)
            if (duplicateByName){
                if (duplicateByName.id != req.params.id) {
                    throw new Error('A pizza by this name already exists.')
                }
            }
            await Pizzas.findByIdAndUpdate(req.params.id, {
                name: req.body.name,
                toppings: req.body.toppings.map(topping => {
                    let id 
                    allToppings.forEach(obj => {
                        if (obj.name == topping){
                            id = obj.id
                            price += Number(obj.price)
                        }})
                    return id}),
                description: req.body.description,
                price: (price + 5.00).toFixed(2),
                users: req.user.id
            })
            console.log('redirecting')
            res.redirect('/')
        }
    } catch(err){
        next(ErrorMessage.badRequest(err))
    }
})
// delete a topping
router.post('/delete', async (req, res, next) => {
    await Toppings.findByIdAndDelete(req.body.id)
    res.redirect('..')
})
// delete a pizza
router.post('/delete-pizza', async (req, res, next) => {
    await Pizzas.findByIdAndDelete(req.body.id)
    res.redirect('..')
})

module.exports = router