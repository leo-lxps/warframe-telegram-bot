# Warframe Telegram Bot

## Setup

Place your Telegram token in a file called `token.json`  in your root directory

````json
{
  "test": "test-bot-telegram-token",
  "main": "main-bot-telegram-token"
}
```` 

To be able to use the admin commands create a `admins.json` file in your root directory:

````json
[
  {
    "username": "telegram-user",
    "role": "role-name"
  },
  [...]
]
````

## Usage

Installation

````bash
npm install
````

Start

````bash
cd src
node wfbot.js
````

## Documentation

### Commands (complete list in commands.json)

- dash - all information in a compact message
- sortie - get current sortie (updates automatically)
- alert - set your alert notification settings
- filter - lists all alert and invasion filters
- drop - OR drops use inline mode @BerndDasBot <Search>
- events - lists current events
- trader - Void trader information
- cetus - Night|Day on cetus
- bosses - lists all bosses
- missions - lists all missions
- optin - opt in daily updates
- optout - opt out of daily updates
- admins - list of admins
- time - ADMIN ONLY add time to times.json
  
  
 ### Screenshots
 
 ![Dashboard Screen](https://i.imgur.com/hK6AJQY.png)
