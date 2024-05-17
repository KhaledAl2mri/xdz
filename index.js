const axios = require('axios');
const cheerio = require('cheerio');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

const website = 'https://www.dzrt.com/ar/our-products.html?product_list_limit=36';
const token = '6723361886:AAEFTvQhaFM4_VZC0NUfFugpbkA5-N8JeIM';

const bot = new TelegramBot(token, {polling: true});

const subscribers = {};
const previousProductDetails = {};
const usedKeys = {};

const keys = require('./keys.json').keys;

let running = false; 
const pendingStart = {}; 

const imageUrlMap = {
  'إيدجي منت': 'https://assets.dzrt.com/media/catalog/product/cache/aa1f447624af049cdecf725fa75b3834/e/d/edgy_mint_6mg_vue03.png',
  'ايسي رش': 'https://assets.dzrt.com/media/catalog/product/cache/aa1f447624af049cdecf725fa75b3834/i/c/icy_rush_10mg_vue03_1.png',
  'منت فيوجن': 'https://assets.dzrt.com/media/catalog/product/cache/aa1f447624af049cdecf725fa75b3834/m/i/mint_fusion_6mg_vue03_2.png',
  'جاردن منت': 'https://assets.dzrt.com/media/catalog/product/cache/aa1f447624af049cdecf725fa75b3834/g/a/garden_mint_6mg_vue03_1.png',
  'سي سايد فروست': 'https://assets.dzrt.com/media/catalog/product/cache/aa1f447624af049cdecf725fa75b3834/s/e/seaside_frost_10mg_vue03_1.png',
  'هايلاند بيريز': 'https://assets.dzrt.com/media/catalog/product/cache/aa1f447624af049cdecf725fa75b3834/h/i/highland_berries_6mg_vue03_1.png',
  'بيربل مست': 'https://assets.dzrt.com/media/catalog/product/cache/aa1f447624af049cdecf725fa75b3834/p/u/purple_mist_3mg_vue03-20230707.png',
  'سبايسي زيست': 'https://assets.dzrt.com/media/catalog/product/cache/aa1f447624af049cdecf725fa75b3834/s/p/spicy_zest_3mg_vue03_1.png',
};

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  if (!subscribers[chatId]) {
    bot.sendMessage(chatId, 'مرحباً! أنا بوت تلقائي لمتابعة المنتجات. يمكنك تفعيلي أو الاطلاع على حالة المنتجات.', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'تفعيل', callback_data: 'activate' }]
        ]
      }
    });
  } else {
    bot.sendMessage(chatId, 'مرحباً مرة أخرى! شكراً لك على استخدام البوت.');
  }
});

bot.on('callback_query', (callbackQuery) => {
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;

  if (callbackQuery.data === 'cancel_start') {
    pendingStart[chatId] = false;
    bot.deleteMessage(chatId, msg.message_id); 
    bot.sendMessage(chatId, 'تم إلغاء التفعيل.');
  } else if (callbackQuery.data === 'activate') {
    if (!subscribers[chatId]) { 
      pendingStart[chatId] = true;
      bot.sendMessage(chatId, 'الرجاء كتابة الرمز لتفعيل البوت.', {
        reply_markup: {
          inline_keyboard: [[{ text: 'إلغاء', callback_data: 'cancel_start' }]]
        }
      });
    } else {
      bot.deleteMessage(chatId, msg.message_id);
    }
  }
});

bot.onText(/(.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const text = match[1];

  if (pendingStart[chatId] && !text.startsWith('/')) {
    const key = text;

    const keyInUse = Object.values(subscribers).includes(key);

    const keyHasBeenUsed = usedKeys[key];

    if (keyHasBeenUsed) {
      bot.sendMessage(chatId, 'هذا الرمز تم استخدامه بالفعل. حاول مرة أخرى برمز آخر.');
    } else if (keyInUse) {
      bot.sendMessage(chatId, 'هذا الرمز مستخدم بالفعل. حاول مرة أخرى برمز آخر.');
    } else if (keys.includes(key)) {
      subscribers[chatId] = key; 
      usedKeys[key] = true; 
      running = true; 
      bot.sendMessage(chatId, 'تم تفعيل البوت لك. \n اكتب امر /status حتى ترى حالة كل المنتجات \n سيتم ارسال المنتجات لك بمجرد توفرها');
      pendingStart[chatId] = false;
    } else {
      bot.sendMessage(chatId, 'رمز غير صالح. حاول مرة أخرى.');
    }
  }
});

bot.onText(/\/off/, (msg) => {
  const chatId = msg.chat.id;
  if (subscribers[chatId]) {
    delete subscribers[chatId]; 
    running = Object.keys(subscribers).length > 0; 
    bot.sendMessage(chatId, 'تم إلغاء تفعيل البوت لك.');
  }
});



setInterval(() => {
  if (running) {
    for (const chatId in subscribers){
      if (subscribers[chatId]) {
        axios.get(website).then(response => {
          const $ = cheerio.load(response.data);
          const products = $('li.item.product.product-item');

          products.each((i, product) => {
            const name = $(product).find('strong.product.name').text().trim();
            const availability = $(product).hasClass('unavailable')? 'غير متوفر' : 'متوفر';
            const link = $(product).find('a.product-item-link').attr('href');

            const imageUrl = imageUrlMap[name];

            if (!previousProductDetails[name] || previousProductDetails[name].availability!== availability) {
              if (availability === 'متوفر') {
                const message = `اسم المنتج: ${name}\n الحالة : ${availability}`;
                const opts = {
                  caption: message,  
                  reply_markup: JSON.stringify({
                    inline_keyboard: [
                      [{ text: 'شراء الآن', url: link }]
                    ]
                  })
                };

                bot.sendPhoto(chatId, imageUrl, opts);
              }

              previousProductDetails[name] = { availability: availability, timestamp: Date.now() };
            }
          });
        });
      }
    }
  }
}, 15000); // Check every 15 seconds


bot.onText(/\/status/, (msg) => {
  const chatId = msg.chat.id;
  if (subscribers[chatId]) {
    axios.get(website).then(response => {
      const $ = cheerio.load(response.data);
      const products = $('li.item.product.product-item');
      let summary = "حالة جميع المنتجات 📊\n \n";

      products.each((i, product) => {
        const name =  $(product).find('strong.product.name').text().trim();
        const availability = $(product).hasClass('unavailable') ? 'غير متوفر' : 'متوفر';

        summary += `اسم المنتج: ${name}\n الحالة : ${availability}\n\n`;

        const imageUrl = imageUrlMap[name];

        if (availability === 'متوفر' && (!previousProductDetails[name] || previousProductDetails[name].availability !== availability)) {
          previousProductDetails[name] = { availability: availability };
        }
      });

      bot.sendMessage(chatId, summary);
    });
  }
});
