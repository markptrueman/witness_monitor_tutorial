// import required libraries.
const steem = require('steem')
const dsteem = require('dsteem')
const discord = require('discord.io')
const moment = require('moment')
const fs = require('fs')



const accountname = 'markangeltrueman' // witness that you are monitoring

let missedCount = -1;
let lastConfirmed = -1;


/** you can get your discord user id by tagging yourself in discord and then adding a backslash in front of your username
* for example  \@MarkAngelTrueman#5965
* this will return your discord user id in the format 
* <@123234234123123234>
* Just add the numeric part here
*/

let config = JSON.parse(fs.readFileSync('config.json'))

let discorduser = config.DISCORD_USER;
let token = config.DISCORD_TOKEN;
let useBotOutput = true;


// set the steem API to use the RPC url of your choice
steem.api.setOptions({ url: 'https://api.steemit.com' });
const client = new dsteem.Client('https://api.steemit.com');


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


let message = (message) => 
{
    console.log(moment().utc().format("YYYY-MM-DD HH:mm:ss") + " : " + message);

    // send a message to a user id when you are ready
    if (useBotOutput)   {
        bot.sendMessage({
            to: discorduser,
            message: moment().utc().format("YYYY-MM-DD HH:mm:ss") + " : " + message
        });
    }
}


// ready callback is fired once the bot is connected.
bot.on('ready', function() {
    console.log('Logged in as %s - %s\n', bot.username, bot.id);

    // send a message to a user id when you are ready
    message("Witness Monitor Bot Starting.....")
 

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

        

        steem.api.streamOperations(function(err,res){
            
            if(res[0] && res[0] === 'account_witness_vote' && res[1].witness === accountname) {
                steem.api.getAccounts([res[1].account], async function(err,resp) {

                    const globalprops = await steem.api.getDynamicGlobalPropertiesAsync();
                    // calculate vests
                    const totalSteem = Number(globalprops.total_vesting_fund_steem.split(' ')[0]);
                    const totalVests = Number(globalprops.total_vesting_shares.split(' ')[0]);
                    const userVests = Number(resp[0].vesting_shares.split(' ')[0]);

                    let sp =  totalSteem * (userVests / totalVests);

                    if (res[1].approve === true)
                    {
                        message("Witness approved by - " + res[1].account + " with SP of " + sp.toFixed(2))
                    }
                    else {
                        message("Witness unapproved by - " + res[1].account + "with SP of " + sp.toFixed(2))
                    }
                });
               
                

            }

        })

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
                   
                    lastConfirmed = witness.last_confirmed_block_num;
                    message("Initial Missed Block Count = " + missedCount)
                    
               
                    }
                catch (e){
                    message("Error in getWitnessByAccount " + e)
                    
                }
            

                
            }
            else {
                // check the  missedCount against the current live missed count
                
                try {    
                    let witness = await steem.api.getWitnessByAccountAsync(accountname);
        
                    if (witness.total_missed > missedCount) 
                    {
                        // we have missed a block!!!
                        message("⚠⚠⚠ Witness Missed a block ⚠⚠⚠");
                        
                        missedCount = witness.total_missed;
                    }
                    // check for produced blocks
                    if (witness.last_confirmed_block_num != lastConfirmed)
                    {
                        // have produced a block
                        lastConfirmed = witness.last_confirmed_block_num;
                        message("Witness has produced a block");
                       
                    }

                    
                }
                catch (e)
                {
                    message("Error in getWitnessByAccount " + e)
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