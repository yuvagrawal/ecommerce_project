require('dotenv').config();
const express = require("express");
const server = express();
const mongoose = require('mongoose');
const { createProduct } = require("./controller/Product");
const productsRouter = require("./routes/Products")
const brandsRouter = require("./routes/Brands")
const jwt = require('jsonwebtoken'); // learn concepts of jwt token from jwt.io
const cookieParser = require('cookie-parser');
const categoriesRouter = require("./routes/Categories")
const usersRouter = require('./routes/Users')
const authRouter = require('./routes/Auth')
const cartRouter = require('./routes/Cart')
const ordersRouter = require('./routes/Order')
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const cors = require('cors');
const { User } = require("./model/User");
const crypto = require('crypto');
const { isAuth, sanitizeUser, cookieExtractor } = require("./services/common");
const path = require('path');
const { Order } = require('./model/Order');

//webhook 
const endpointSecret = process.env.ENDPOINT_SECRET;
server.post('/webhook',express.raw({type: 'application/json'}), async (request, response) => {
  const sig = request.headers['stripe-signature'];

  let event;
  //console.log(request)
  try {
    event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
  } catch (err) {
    response.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntentSucceeded = event.data.object;
      console.log({paymentIntentSucceeded});

      const order = await Order.findById(paymentIntentSucceeded.metadata.orderId);
      order.paymentStatus = 'received';
      await order.save();

      break;
    // ... handle other event types
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  response.send();
});

var opts = {}
opts.jwtFromRequest = cookieExtractor;
opts.secretOrKey = process.env.JWT_SECRET_KEY;

//middleware
server.use(express.static(path.resolve(__dirname,'build')));
server.use(cookieParser());
server.use(session({
    secret: process.env.SESSION_KEY,
    resave: false, // don't save session if unmodified
    saveUninitialized: false, // don't create session until something stored
  }));
server.use(passport.authenticate('session'));

server.use(cors({exposedHeaders:['X-Total-Count']}));

server.use(express.json());
//server.use(express.raw({type: '*/*'}));
server.use('/products',isAuth(),productsRouter.router);
server.use('/brands',isAuth(),brandsRouter.router);
server.use('/categories',isAuth(),categoriesRouter.router);
server.use('/users',isAuth(),usersRouter.router);
server.use('/auth',authRouter.router);
server.use('/cart',isAuth(),cartRouter.router);
server.use('/orders',isAuth(),ordersRouter.router);
server.get('*',(req,res) => res.sendFile(path.resolve('build','index.html')));


passport.use('local',new LocalStrategy(
    {usernameField : 'email'},
    async function(email, password, done) {
        try {
            const user = await User.findOne({email:email}).exec();
            console.log(email,password,user);
            if(!user){
                done(null,false,{message : "invalid credentials"})
            }
            crypto.pbkdf2(password, user.salt, 310000, 32, 'sha256',async function(err, hashedPassword)
            {
              if (!crypto.timingSafeEqual(user.password, hashedPassword))  {
               return done(null,false,{message : "invalid credentials"})     
              }
              const token = jwt.sign(sanitizeUser(user),process.env.JWT_SECRET_KEY);
              done(null,{id:user.id,role:user.role,token});
            });
        }catch(err){
            done(err);
       }  
    }
  ));

passport.use('jwt',new JwtStrategy(opts, async function(jwt_payload, done) {
    console.log('inside passport',{jwt_payload});
    try{
        const user = await User.findById(jwt_payload.id); 
        if (user) {
            return done(null,sanitizeUser(user));
        } else {
            return done(null, false);
    }
  }
    catch(err){
        if (err) {
            return done(err, false);
        }
    }
}));

// this creates session variable req.user on being called from callbacks
passport.serializeUser(function(user, cb) {
    console.log("serialize",user);
    process.nextTick(function() {
      return cb(null, {id:user.id,role:user.role});
    });
  });

// this changes session variable req.user when called  from authorized requests
passport.deserializeUser(function(user, cb) {
    console.log("de-serialize",user);
    process.nextTick(function() {
      return cb(null, user);
    });
  });

//Payments 

// This is your test secret API key.
const stripe = require("stripe")(process.env.STRIPE_SERVER_KEY);

server.post("/create-payment-intent", async (req, res) => {
  const { totalAmount,orderId } = req.body;

  // Create a PaymentIntent with the order amount and currency
  const paymentIntent = await stripe.paymentIntents.create({
    amount: totalAmount*100,
    currency: "inr",
    // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
    automatic_payment_methods: {
      enabled: true,
    },
    metadata:{
         orderId
    }
  });

  res.send({
    clientSecret: paymentIntent.client_secret,
  });
});



//resumed  after payment part
main().catch(err=>console.log(err));

async function main(){
    await mongoose.connect(process.env.MONGODB_URL);
    console.log("database connected");
}

/*server.get('/',(req,res)=>{
    res.json({status:"successful"});
})*/

server.listen(process.env.PORT,()=>{
    console.log("server started")
});