const bodyParser = require('body-parser')
const express = require('express')
const router = express.Router()
const urlencodedParser = bodyParser.urlencoded({ extended: false })
router.use(urlencodedParser)
const Mattermost = require('../models/Mattermost')
const { startBot } = require('../bots')
const { loginAndGetUser } = require('../mattermost')

router.get('/mattermost', function (req, res) {
    res.render('pages/mattermost', { error: false })
})

router.post('/mattermost', async function (req, res) {
    const { server, email, password } = req.body
    const user = await loginAndGetUser(server, email, password)
    if (!user) {
        res.render('pages/mattermost', { error: true })
    } else {
        // save the user
        const mattermost = new Mattermost({server, email, password})
        mattermost.save()
        startBot('mattermost', mattermost)
        res.redirect('/mattermost-success')
    }
})

router.get('/mattermost-success', function (req, res) {
    res.render('pages/added-to-team')
})

module.exports = router

