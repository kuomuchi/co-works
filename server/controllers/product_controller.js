const _ = require('lodash');
const util = require('../../util/util');
const Product = require('../models/product_model');
const pageSize = 6;

const createProduct = async (req, res) => {
    const body = req.body;
    const product = {
        id: body.product_id,
        category: body.category,
        title: body.title,
        description: body.description,
        price: body.price,
        texture: body.texture,
        wash: body.wash,
        place: body.place,
        note: body.note,
        story: body.story
    };
    product.main_image = req.files.main_image[0].filename;
    product.images = req.files.other_images.map(img => img.filename).join(',');
    const colorCodes = body.color_codes.split(',');
    const colorNames = body.color_names.split(',');
    const sizes = body.sizes.split(',');

    let variants = sizes.flatMap((size) => {
        return colorCodes.map((color_code, i) => {
            return [
                color_code,
                colorNames[i],
                size,
                Math.round(Math.random()*10),
                product.id
            ];
        });
    });

    const productId = await Product.createProduct(product, variants);
    res.status(200).send({productId});
};

const getProducts = async (req, res) => {
    const category = req.params.category;
    const paging = parseInt(req.query.paging) || 0;

    async function findProduct(category) {
        switch (category) {
            case 'all':
                return await Product.getProducts(pageSize, paging);
            case 'men': case 'women': case 'accessories':
                return await Product.getProducts(pageSize, paging, {category});
            case 'search': {
                const keyword = req.query.keyword;
                if (keyword) {
                    return await Product.getProducts(pageSize, paging, {keyword});
                }
                break;
            }
            case 'hot': {
                return await Product.getProducts(null, null, {category});
            }
            case 'details': {
                const id = parseInt(req.query.id);
                if (Number.isInteger(id)) {
                    return await Product.getProducts(pageSize, paging, {id});
                }
            }
        }
        return Promise.resolve({});
    }
    const {products, productCount} = await findProduct(category);
    if (!products) {
        res.status(400).send({error:'Wrong Request'});
        return;
    }

    if (products.length == 0) {
        if (category === 'details') {
            res.status(200).json({data: null});
        } else {
            res.status(200).json({data: []});
        }
        return;
    }

    let productsWithDetail = await getProductsWithDetail(req.protocol, req.hostname, products);

    if (category == 'details') {
        productsWithDetail = productsWithDetail[0];
    }

    const result = (productCount > (paging + 1) * pageSize) ? {
        data: productsWithDetail,
        next_paging: paging + 1
    } : {
        data: productsWithDetail,
    };

    res.status(200).json(result);
};

const getProductsWithDetail = async (protocol, hostname, products) => {
    const productIds = products.map(p => p.id);
    const variants = await Product.getProductsVariants(productIds);
    const variantsMap = _.groupBy(variants, v => v.product_id);

    return products.map((p) => {
        const imagePath = util.getImagePath(protocol, hostname, p.id);
        p.main_image = p.main_image ? imagePath + p.main_image : null;
        p.images = p.images ? p.images.split(',').map(img => imagePath + img) : null;

        const productVariants = variantsMap[p.id];
        if (!productVariants) { return p; }

        p.variants = productVariants.map(v => ({
            color_code: v.color_code,
            size: v.size,
            stock: v.stock,
        }));

        const allColors = productVariants.map(v => ({
            code: v.color_code,
            name: v.color_name,
        }));
        p.colors = _.uniqBy(allColors, c => c.code);

        const allSizes = productVariants.map(v => v.size);
        p.sizes = _.uniq(allSizes);
        return p;
    });
};

module.exports = {
    createProduct,
    getProductsWithDetail,
    getProducts,
};