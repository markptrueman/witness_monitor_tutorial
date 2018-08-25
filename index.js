// import required libraries.
const steem = require('steem')
const discord = require('discord.io')
const moment = require('moment')
const fs = require('fs')

let config = JSON.parse(fs.readFileSync('config.json'))

/** you can get your discord user id by tagging yourself in discord and then adding a backslash in front of your username
* for example  \@MarkAngelTrueman#5965
* this will return your discord user id in the format 
* <@123234234123123234>
* Just add the numeric part here
*/


const accountname = config.WITNESS; // witness that you are monitoring
const discorduser = config.DISCORD_USER;
const token = config.DISCORD_TOKEN;
const postDailyStats = config.POST_DAILY_STATS;
const useDiscord = config.USE_DISCORD;
const failoverTest = config.TEST_MODE;
const wif = config.WIF;
const url = config.WITNESS_URL;
const props = config.WITNSS_PROPS;
const disableKey = config.DISABLE_KEY;



let missedCount = -1;
let lastConfirmed = -1;
let witness = null;





let lastDailyReport = moment().utc().dayOfYear() - 1;

let dailyStats = {
    date: moment(),
    missedToday: 0,
    createdToday: 0,
}

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


let message = (message) => 
{
    console.log(moment().utc().format("YYYY-MM-DD HH:mm:ss") + " : " + message);

    // send a message to a user id when you are ready
    if (useDiscord)   {
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

bot.on('message', function(user, userID, channelID, message, event) {
   
    if (message === "!stats")
    {
      sendStats(false);
    }
})

let sendStats = async (yest) => {
   

    // get witness postition
    try {
        let data = await steem.api.getWitnessesByVoteAsync("", 200);
        // loop through this and get the position that your witness is in after removing all of those with null signing_key
        let activePosition = 0;
        let inactivePosition = 0;

        for (var i = 0; i < data.length; i++)
        {
            if (data[i].owner === accountname)
            {
                activePosition++;
                inactivePosition++
                break;
            }
            else {
                if (data[i].signing_key.startsWith("STM1111111"))
                {
                    // inactive 
                    inactivePosition++
                }
                else {
                    activePosition++;
                    inactivePosition++;
                }
                
            }
        }



        var report = "Daily report for ";
        var yesterday =  moment().utc().subtract(1, 'days')
        if (yest) {
        report += yesterday.format('MMM DD');
        }
        else { 
        report += moment().utc().format('MMM DD');
        }
        report+= "\r\n";
        report += "Witness missed " + dailyStats.missedToday + " blocks today.";
        report+= "\r\n";
        report += "Witness created " + dailyStats.createdToday + " blocks today.";
        report+= "\r\n";
        report += "Witness position : Inactive - " + inactivePosition + " / Active - " + activePosition;
        report+= "\r\n";
        report+= "Witness running version : " + witness.running_version;
    
        message(report)
    }
    catch (e)
    {
        message("Unable to send report " + e)
    }
    
    
  }
  
  let resetDailyStats = async () => {
    dailyStats = {
      missedToday: 0,
      createdToday: 0,
      currentFullStatus: true,
      currentSeedStatus: true,
    }
  }

  let handleWitnessFailover = async () => {
      try {
          if (!failoverTest)
          {
            let result = await steem.broadcast.witnessUpdateAsync(wif, accountname, url, blockSigningKey, props, fee);
             message("Witness has failed over " + JSON.stringify(result));
          }
          else {
            message("TEST MODE : Witness has failed over ");
          }
      }
      catch (e)
      {
          message("Unable to perform witness update " + e)
      }
  }

/**
 * 
 *  Main program loop
 * 
 */
 
let start = async() => {
    try {

        

        steem.api.streamOperations(function(err,res){
            
            if(res && res[0] === 'account_witness_vote' && res[1].witness === accountname) {
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
                    witness = await steem.api.getWitnessByAccountAsync(accountname);
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
                    witness = await steem.api.getWitnessByAccountAsync(accountname);
        
                    if (witness.total_missed > missedCount) 
                    {
                        // we have missed a block!!!
                        dailyStats.missedToday = dailyStats.missedToday + 1;
                        message("⚠⚠⚠ Witness Missed a block ⚠⚠⚠");
                        
                        missedCount = witness.total_missed;
                    }
                    // check for produced blocks
                    if (witness.last_confirmed_block_num != lastConfirmed)
                    {
                        // have produced a block
                        lastConfirmed = witness.last_confirmed_block_num;
                        dailyStats.createdToday = dailyStats.createdToday + 1;
                        message("Witness has produced a block");

                       
                    }

                    
                }
                catch (e)
                {
                    message("Error in getWitnessByAccount " + e)
                }
            }

            // wait 60 seconds for next check
            if (postDailyStats && moment().utc().dayOfYear() > lastDailyReport ) {
                await sendStats(true);
                await resetDailyStats();
                lastDailyReport = moment().utc().dayOfYear();
              }
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