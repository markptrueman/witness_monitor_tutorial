// import required libraries.
const steem = require('steem')
const discord = require('discord.io')
const moment = require('moment')

const accountname = 'markangeltrueman' // witness that you are monitoring

let missedCount = -1;

/** you can get your discord user id by tagging yourself in discord and then adding a backslash in front of your username
* for example  \@MarkAngelTrueman#5965
* this will return your discord user id in the format 
* <@123234234123123234>
* Just add the numeric part here
*/

let discorduser = '123234234123123234';
let token = 'your discord token here'

// set the steem API to use the RPC url of your choice
steem.api.setOptions({ url: 'https://api.steemit.com' });

/**
 * 
 *  Bot configuration stuff
 * 
 */
// create a new bot instance
let bot = new discord.Client({
    token: token , 
    autorun: true
});

// ready callback is fired once the bot is connected.
bot.on('ready', function() {
    console.log('Logged in as %s - %s\n', bot.username, bot.id);

    // send a message to a user id when you are ready
    bot.sendMessage({
        to: discorduser,
        message: moment().utc().format("YYYY-MM-DD HH:mm:ss") + " : Witness Monitor Bot Starting....."
    });

});

// handle a disconnect from discord by attempting to reconnect
bot.on('disconnect', function(erMsg, code) {

    console.log('----- Bot disconnected from Discord with code', code, 'for reason:', erMsg, '-----');
    bot.connect();
});

/**
 * 
 *  Main program loop
 * 
 */

let start = async() => {
    try {

        // wait 10 seconds before you start for the bot to connect
        await timeout(10)


        while(true) {

            // if the blockcount is -1, we are initialising
            if (missedCount == -1)
            {
                console.log("Initialising current blockcount....");
               // go and get witness information
               try {    
                    let witness = await steem.api.getWitnessByAccountAsync(accountname);
                    missedCount = witness.total_missed;
                    bot.sendMessage({
                        to: discorduser,
                        message: moment().utc().format("YYYY-MM-DD HH:mm:ss") +  " : " + accountname + " Initial Missed Block Count = " + missedCount
                    });
                    console.log("Initial Missed Block count = " + missedCount)
               
                    }
                catch (e){
                    console.log("Error in getWitnessByAccount " + e)
                    bot.sendMessage({
                        to: discorduser,
                        message: moment().utc().format("YYYY-MM-DD HH:mm:ss") +  " : " + accountname + " Error in getWitnessByAccount " + e
                    });
                }
            

                
            }
            else {
                // check the  missedCount against the current live missed count
                
                try {    
                    let witness = await steem.api.getWitnessByAccountAsync(accountname);
        
                    if (witness.total_missed > missedCount) 
                    {
                        // we have missed a block!!!
                        console.log("Witness has missed a block");
                        bot.sendMessage({
                                to: discorduser,
                                message: moment().utc().format("YYYY-MM-DD HH:mm:ss") +  " : ⚠⚠⚠ Witness Missed a block ⚠⚠⚠"
                            });

                        missedCount = witness.total_missed;
                    }
                }
                catch (e)
                {
                    console.log("Error in getWitnessByAccount " + e)
                    bot.sendMessage({
                        to: discorduser,
                        message: moment().utc().format("YYYY-MM-DD HH:mm:ss") +  " : " + accountname + " Error in getWitnessByAccount " + e
                    });
                }
            }

            // wait 60 seconds for next check
            await timeout(60)
        }
    } catch (e) {
        console.error('start', e)
        release();
        start()
    }
}

// a helper function to to a wait
let timeout = (sec) => {
    return new Promise(resolve => setTimeout(resolve, sec * 1000))
}

start();