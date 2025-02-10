// import express.js,axios,redis
const express = require('express');
const axios = require('axios');
const redis = require('redis');

//create app and client objects 
const app = express();
const client = redis.createClient();

// initiate/connect to the redis server
client.connect().then(() => {console.log("connected to redis server")}).catch((err) => console.log(err));

//imported variables from .env folder
const PORT = process.env.port || 3000;
const openweathermapAPIkey = process.env.WeatherAPIkey;
const NewsApiKey = process.env.NewsAPIkey;

// using crud operation to fetch and display weather/news data in json format
app.get('/search',async (req,res) =>{

    const cityname = req.query.place;
        
    if(!cityname){
        return res.status(400).json({error : "Please enter a cityname"});
    }
    // try-catch for error-handling
    try {
        const cachedData = await client.get(cityname)
        //retrieve data from redis server if it exists
        if (cachedData){
            console.log("Fetched data from redis")
            return res.status(200).json(JSON.parse(cachedData))
        }

        const today = new Date().toISOString().split("T")[0];
        const three_days_back = new Date();
        three_days_back.setDate(three_days_back.getDate()-3);
        const Fromdate = three_days_back.toISOString().split("T")[0];
        
        //fetching latitude,longitude data from geocoding api(OpenWeatherMap)
        const geo_response = await axios.get(`http://api.openweathermap.org/geo/1.0/direct?q=${cityname}&appid=${openweathermapAPIkey}`);
        
        if(geo_response.data.length == 0){
            return res.status(400).json({error: "invalid city name, please enter valid name"});
        }
        const {lat,lon} = geo_response.data[0];
        
        //fetch news, weather details from respective api
        const responses = await Promise.all([axios.get(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${openweathermapAPIkey}`),
        axios.get(`https://newsapi.org/v2/everything?q=${cityname}&searchIn=title,description&from=${Fromdate}&to=${today}&sortBy=popularity&apiKey=${NewsApiKey}`)]);
            
        //destructuring and converting the response to an object
        const [weather_response,news_response] = responses;
        const RESPONSE = {Weather: weather_response.data, News: news_response.data};
            
        //add new data to redis for 1 hr 
        client.setEx(cityname,3600,JSON.stringify(RESPONSE));
        return res.json(RESPONSE);

    } catch (error) {

        console.log(error);
        res.status(500).json({error: "An error has occured"});
    }
    
});

app.listen(PORT,console.log(`listening on port ${PORT}`));