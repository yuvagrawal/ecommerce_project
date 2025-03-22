//Note  change 'to' value in createorder sendmail before checking
const { Order } = require("../model/Order");
const { Product } = require("../model/Product");
const { User } = require("../model/User");
const { sendMail, invoiceTemplate } = require("../services/common");

exports.fetchOrdersByUser = async (req,res) => {
    const {id} = req.user;
    try{
       const orders = await Order.find({user:id});
       res.status(200).json(orders);
    }catch(err){
        res.status(400).json(err);
    }
}

exports.createOrder = async (req,res) =>{
    const order = new Order(req.body);

    for(let item of order.items){
        let product = await Product.findOne({_id:item.product.id});
        product.$inc('stock',-1*item.quantity);
        await product.save();
    }
    try {
        const doc = await order.save();
        const user = await User.findById(order.user);
        //console.log("email  :",user.email);
        sendMail({to:user.email,html:invoiceTemplate(order),subject:"Order Received"}) ;//'yuvrajagrawal61@gmail.com' //user.email
        res.status(201).json(doc);
    }catch(err){
        res.status(400).json(err);
    }
}

exports.deleteOrder = async (req,res) =>{
    const {id} = req.params;
    try {
        const order = await Order.findByIdAndDelete(id);
        res.status(200).json(order);
    }catch(err){
        res.status(400).json(err);
    }
}

exports.updateOrder = async (req,res) =>{
    const {id} = req.params;
    try{
        const order = await Order.findByIdAndUpdate(id,req.body,{new:true});
        res.status(200).json(order);
    }catch(err){
        res.status(400).json(err);
    }
}

exports.fetchAllOrders = async (req, res) => {
    try {
        let query = Order.find({ deleted: { $ne: true } });
        let totalOrdersQuery = Order.find({ deleted: { $ne: true } });

        if (req.query._sort && req.query._order) {
            query = query.sort({ [req.query._sort]: req.query._order });
        }

        // ✅ Fix: Use countDocuments() instead of count()
        const totalDocs = await totalOrdersQuery.countDocuments();
        console.log({ totalDocs });

        if (req.query._page && req.query._limit) {
            const pageSize = parseInt(req.query._limit);
            const page = parseInt(req.query._page);
            query = query.skip(pageSize * (page - 1)).limit(pageSize);
        }

        const doc = await query.exec();
        res.set('X-Total-Count', totalDocs);
        res.status(200).json(doc);

    } catch (err) {
        console.error("Error fetching orders:", err);
        res.status(500).json({ message: "Internal Server Error", error: err.message });
    }
};

