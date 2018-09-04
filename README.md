# Warframe Telegram Bot

## Setup

Place your Telegram token in a file called `token.json`  in your root directory

````json
{
  "test": "test-bot-telegram-token",
  "main": "main-bot-telegram-token"
}
```` 

To be able to use the admin commands create a `admins.json` file in root directory:

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
node wfbot.js
````

## Documentation

none :)