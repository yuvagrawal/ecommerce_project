const {Product} = require("../model/Product")
exports.createProduct = async (req,res) =>{
    const product = new Product(req.body);
    product.discountedPrice = Math.round(product.price*(1-product.discountPercentage/100));
    try {
        const doc = await product.save();
        res.status(201).json(doc);
    }catch(err){
        res.status(400).json(err);
    }
}

exports.fetchAllProducts = async (req, res) => {
    try {
        let condition = {};
        if (!req.query.admin) {
            condition.deleted = { $ne: true };
        }

        let query = Product.find(condition);
        let totalProductsQuery = Product.find(condition);

        if (req.query.category) {
            const categories = req.query.category.split(',');
            query = query.find({ category: { $in: categories } });
            totalProductsQuery = totalProductsQuery.find({ category: { $in: categories } });
        }

        if (req.query.brand) {
            const brands = req.query.brand.split(',');
            query = query.find({ brand: { $in: brands } });
            totalProductsQuery = totalProductsQuery.find({ brand: { $in: brands } });
        }

        if (req.query._sort && req.query._order) {
            query = query.sort({ [req.query._sort]: req.query._order });
        }

        // ✅ Fix: Use countDocuments() instead of count()
        const totalDocs = await totalProductsQuery.countDocuments();
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
        console.error("Error fetching products:", err);
        res.status(500).json({ message: "Internal Server Error", error: err.message });
    }
};


exports.fetchProductById = async (req,res) =>{
    const {id} = req.params;
    try{
        const product = await Product.findById(id);
        res.status(200).json(product);
    }catch(err){
        res.status(400).json(err);
    }
}

exports.updateProduct = async (req,res) =>{
    const {id} = req.params;
    try{
        const product = await Product.findByIdAndUpdate(id,req.body,{new:true});
        product.discountedPrice = Math.round(product.price*(1-product.discountPercentage/100));
        const updateProduct = await product.save();
        res.status(200).json(updateProduct);
    }catch(err){
        res.status(400).json(err);
    }
}
