/*
*
*
*       Complete the API routing below
*
*
*/

'use strict';

var expect = require('chai').expect;

var fetch = require("node-fetch");
var os = require('os').networkInterfaces();
const stock_key = process.env.STOCK_API;

module.exports = function (app, db) {
const stockBase = db.db("test").collection("stockbase");

  
  async function getStock(stock){
    
      const fetchData = await fetch(`https://cloud.iexapis.com/stable/stock/${stock}/quote?token=${stock_key}`);
      if(fetchData.status == 404){
        return {error:"stock not found"}
      };
      const {symbol, latestPrice} = await fetchData.json();
       if(symbol && latestPrice){
        return {
        symbol,
        price:`${latestPrice}`      
    }
   }else{
     return {error:"invalid stock"}
   }
    
  }
 
  
  app.route('/api/stock-prices')
    .get(async function (req, res){
    
    const {stock} = req.query;       
    const like = req.query.like=="true"?true:false;
    var ip="";
    
    async function checkIp(){
          if(like==true){
          ip = req.ip; //req.headers['x-forwarded-for'].split(",")[0];
          
      }
    };
    checkIp();
    
    
    if(typeof stock=="string"){
         // single stock query
      if((await getStock(stock)).error){   
       // send error if stock is not listed       
       res.json({error:"invalid stock"});
     }else{
       const singleSymbol = stock.toUpperCase();
       stockBase.findOne({symbol:singleSymbol}, async (err, data)=>{
         if(ip!=""){
           if(data == null){             
             stockBase.insertOne({symbol:singleSymbol, price: (await getStock(stock)).price, likeByIps:[ip]});
             await res.json({stockData:{symbol:singleSymbol, price: (await getStock(stock)).price, likes:1}});           
           }else{
             stockBase.updateOne({symbol:singleSymbol}, {$set:{price: (await getStock(stock)).price}, $addToSet:{likeByIps:ip}});
             stockBase.findOne({symbol:singleSymbol}, (err, d)=>{
                res.json({stockData:{symbol:d.symbol, price:d.price, likes:d.likeByIps.length}});
             })             
           }    
           
         }else{
           if(data == null){
             stockBase.insertOne({symbol:singleSymbol, price: (await getStock(stock)).price, likeByIps:[]});
             res.json({stockData: {symbol: singleSymbol, price: (await getStock(stock)).price, likes:0}});
           }else{
             stockBase.updateOne({symbol:singleSymbol}, {$set:{price: (await getStock(stock)).price}});
             stockBase.findOne({symbol:singleSymbol}, (err, d)=>{
                res.json({stockData:{symbol:d.symbol, price:d.price, likes: d.likeByIps.length}});
             })
           }
         }
        });
      }    
    } else {
      var sortStock=[];
      const stockOne = stock[0].toUpperCase();
      const stockTwo = stock[1].toUpperCase();
      
      function handleStockCollection(d){
    
        if(d.length===2){
        sortStock.push({symbol:d[0].symbol, price:d[0].price, rel_likes:d[0].likeByIps.length-d[1].likeByIps.length});
        sortStock.push({symbol:d[1].symbol, price:d[1].price, rel_likes:d[1].likeByIps.length-d[0].likeByIps.length});
       
          res.json({stockData: sortStock});  
          
      }else{
        res.json({error: "invalid stock comparison"})
        }
      }
      
    
      stockBase.find({symbol:{$in: [stockOne, stockTwo]}}).toArray( async (err, data)=>{
        var tempStock = [];        
        if(ip !="" && stockOne!==stockTwo){
          if(data.length === 0){
           for(let i=0; i<2; i++){
               if((await getStock(stock[i])).price){
               stockBase.insertOne({symbol: stock[i].toUpperCase(), price: (await getStock(stock[i])).price, likeByIps:[ip]});
               tempStock.push({symbol: stock[i].toUpperCase(), price: (await getStock(stock[i])).price, likeByIps:[ip]});
             }
           }  
          }if(data.length===1){         
             if(data[0].symbol===stockOne && (await getStock(stockTwo)).price){
               stockBase.insertOne({symbol:stockTwo, price: (await getStock(stockTwo)).price, likeByIps:[ip]});
               stockBase.updateOne({symbol:stockOne}, {$set:{price:(await getStock(stockOne)).price}, $addToSet:{likeByIps:ip}});
               
               tempStock.push({symbol:stockOne, price: (await getStock(stockOne)).price, likeByIps: data[0].likeByIps},
                              {symbol:stockTwo, price: (await getStock(stockTwo)).price, likeByIps:[ip]})
               
             }else if(data[0].symbol===stockTwo && (await getStock(stockOne)).price){
               stockBase.insertOne({symbol:stockOne, price: (await getStock(stockOne)).price, likeByIps:[ip]});
               stockBase.updateOne({symbol:stockTwo}, {$set:{price: (await getStock(stockTwo)).price}, $addToSet:{likeByIps:ip}});
               
               tempStock.push({symbol:stockOne, price: (await getStock(stockOne)).price, likeByIps:[ip]},                                
                              {symbol:stockTwo, price: (await getStock(stockTwo)).price, likeByIps:data[0].likeByIps});
               
             }else{tempStock=["invalid stocks"]}            
          }
          if(data.length===2){
            stockBase.updateOne({symbol:data[0].symbol}, {$set:{price: (await getStock(data[0].symbol)).price}, $addToSet:{likeByIps:ip}});
            stockBase.updateOne({symbol:data[1].symbol}, {$set:{price: (await getStock(data[1].symbol)).price}, $addToSet:{likeByIps:ip}});
            
            tempStock.push({symbol:data[0].symbol, price: (await getStock(data[0].symbol)).price,likeByIps:data[0].likeByIps},
                          {symbol:data[1].symbol, price: (await getStock(data[1].symbol)).price, likeByIps:data[1].likeByIps});
          }
        }
        if(ip ==="" && stockOne !==stockTwo){
          
           if(data.length === 0){
           for(let i=0; i<2; i++){
             if((await getStock(stock[i])).price){
               stockBase.insertOne({symbol: stock[i].toUpperCase(), price: (await getStock(stock[i])).price, likeByIps:[]});
               tempStock.push({symbol: stock[i].toUpperCase(), price: (await getStock(stock[i])).price, likeByIps:[]});
             }
           }  
          }if(data.length===1){      
             if(data[0].symbol===stockOne && (await getStock(stockTwo)).price){
               stockBase.insertOne({symbol:stockTwo, price: (await getStock(stockTwo)).price, likeByIps:[]});
               stockBase.updateOne({symbol:stockOne}, {$set:{price:(await getStock(stockOne)).price}});
               
               tempStock.push({symbol:stockOne, price: (await getStock(stockOne)).price, likeByIps:data[0].likeByIps},
                              {symbol:stockTwo, price: (await getStock(stockTwo)).price, likeByIps:[]});
               
             }else if(data[0].symbol===stockTwo && (await getStock(stockOne)).price){
               stockBase.insertOne({symbol:stockOne, price: (await getStock(stockOne)).price, likeByIps:[]});
               stockBase.updateOne({symbol:stockTwo}, {$set:{price: (await getStock(stockTwo)).price}});
               
               tempStock.push({symbol:stockOne, price: (await getStock(stockOne)).price, likeByIps:[]},                                
                              {symbol:stockTwo, price: (await getStock(stockTwo)).price, likeByIps:data[0].likeByIps});
               
             }else{tempStock=["invalid stocks"]}            
          }
          if(data.length===2){
            stockBase.updateOne({symbol:data[0].symbol}, {$set:{price: (await getStock(data[0].symbol)).price}});
            stockBase.updateOne({symbol:data[1].symbol}, {$set:{price: (await getStock(data[1].symbol)).price}});
            
            tempStock.push({symbol:data[0].symbol, price: (await getStock(data[0].symbol)).price, likeByIps:data[0].likeByIps},
                           {symbol:data[1].symbol, price: (await getStock(data[1].symbol)).price, likeByIps:data[1].likeByIps});
          }
          
        }  
      
        
        if(ip !=="" && tempStock.length===2){
          let one = tempStock[0].likeByIps;
          let two = tempStock[1].likeByIps;
          one.length==0?one.push(ip):one[one.length-1]===ip?one:one.push(ip);
          two.length==0?two.push(ip):two[two.length-1]===ip?two:two.push(ip);
           //console.log(tempStock);
           handleStockCollection(tempStock);
        }else{
          //console.log(tempStock);
          handleStockCollection(tempStock);   
        }
      })
    }
  });
    
};
