const fs = require('fs')
const TwitchJs = require('twitch-js').default
const sound = require("sound-play");
let timeoutHolder



// you can call the help function with `help()` to see this in the command line
const help = () => {
  console.log(`
  \n  addPoints(x) - to add x number of points
  \n  addWheels(x) - to add x number of wheels
  \n  ap(x) - to add x number of points
  \n  aw(x) - to add x number of wheels
  \n  removePoints(x) - to remove x number of points
  \n  removeWheels(x) - to remove x number of wheels
  \n  rp(x) - to remove x number of points
  \n  rw(x) - to remove x number of wheels
  \n  exit() - exit program \n
  `)
}

// put channel username you're using the wheel for here!
let channelToObserve = 'CHANNELNAME'

// Channel who will do the speaking (only needed if you want it to enter a chat message)
let username = "USERNAME"
// Token for the above channel that will do the speaking (only needed if you want it to enter a chat message), 
// you can get the token here  https://twitchapps.com/tmi/ remove the "oauth:" part at the start
let token = "TOKEN"

// Absolute Path to sound you want playing when reaching the goal, leave as ""/null/undefined for no sound
let soundPath = "C:\\PATH\\TO\\SOUND.mp3"
// Volume of the soundfile, works on a scale of 0 to 1
let soundVolume = 1

//Message to send to chat when reaching goal, leave as ""/null/undefined for no chat message, this requires you to have entered a token.
let chatMessage = ""

// set to whatever number you want to be per wheel, ( 0 / 10 )
let goal = 10

// you can manually set the number of points already earned if you need for the next start of the script
let points = 0

// you can manually set the number of wheels already earned if you need for the next start of the script
let wheelCount = 1

// points added per upgraded gift subscription
let pointsToAddPerGiftUpgrade = 1

// points added per gifted subscription
// total point value is multiplied by the sub tier
// and number of gifted months
// eg: tier 3 at 2 months would be `pointsToAddPerGiftSub * 3 * 2`
let pointsToAddPerGiftSub = 1

// points added per resubscription
// total point value is multiplied by the sub tier
// eg: tier 2 would be `pointsToAddPerResubscription * 2`
let pointsToAddPerResubscription = 1

// can be:
// "off" = points are not calculated to the wheeel
// "accumulated" = increases the counter whenever reaching "bitsToIncreasePoints" amount of bits total given, 
//                so several small bit amount from different people can count towards points to the wheel. 
//                also any overflow will be saved towards the next point.
// "single" = only single amount that goes over "bitsToIncreasePoints" will add points towards the bits.
//            There is also no overlow.
let pointsMode = "accumulated"

//The number of points to add whenever reaching the "BitsToIncreasePoints"
let pointsToAddPerCheer = 1

// Bits needed to give points, if the bits cheered is a multiple of this amount several points will be given.
// eg: with this set to 100 and "pointsToAddPerCheer" set to 2 and a bit amount of 500 comes in it would add
// 500/100 * 2 = 10 points to the counter.
let bitsToIncreasePoints = 500

// The command to use in chat to edit the wheel, can be used by broadcaster and moderators.
// Accepts the following commands:
// controlCommandName reset         : Resets the wheel to default settings.
// controlCommandName p+            : Increases the points by 1
// controlCommandName p+ NUMBER     : Increases the points by NUMBER
// controlCommandName p-            : Decreaese the points by 1
// controlCommandName p- NUMBER     : Decreaess the points by NUMBER
// controlCommandName w+            : Increases the wheel by 1
// controlCommandName w+ NUMBER     : Increases the wheel by NUMBER
// controlCommandName w-            : Decreaese the wheel by 1
// controlCommandName w- NUMBER     : Decreaess the wheel by NUMBER
let controlCommandName = "!wheeledit"




const { Events } = TwitchJs.Chat
var chat 
if(token && token !== "TOKEN"){
  console.log("Chat with Token")
  chat = new TwitchJs({token, username, log: { level: 'silent' }}).chat
}else{
  console.log("Chat without Token")
  chat = new TwitchJs({log: { level: 'silent' }}).chat
}

//, log: { level: 'silent' }

chat.connect().then(() => {
  console.log(`
    ************************************\n
    Remember to reset the wheel counter!\n
    ************************************\n
  `)
  console.log(`\n${getCurrentTime()} Joining channel: ${channelToObserve} \n`)
  handleWriteToFile()
  chat.removeAllListeners()
  //console.log("State")
  //console.log(JSON.stringify(State))
  chat.on(Events.PARSE_ERROR_ENCOUNTERED, () => {})

  chat.on("PRIVMSG", ( {message, tags: { badges: {moderator, broadcaster}}})=>{
    if((moderator === "1" || broadcaster === "1") && message.split(" ")[0].toLowerCase() === controlCommandName.toLowerCase()){
      controlCommand(message.split(" "))

    }
  })

  chat.on(Events.CHEER, ({tags: {displayName, bits}}) =>{
    console.log(`${getCurrentTime()} CHEER ${displayName} cheered  ${bits}`)
    bitsPointCalculation(bits)
  })

  chat.on(Events.GIFT_PAID_UPGRADE, ({ tags: { displayName, msgParamSenderName } }) => {
    console.log(`${getCurrentTime()} GIFT_PAID_UPGRADE ${displayName} continuing sub from ${msgParamSenderName}`)
    addPoints(pointsToAddPerGiftUpgrade)
  })

  chat.on(Events.ANON_GIFT_PAID_UPGRADE, () => {
    console.log(`${getCurrentTime()} ANON_GIFT_PAID_UPGRADE`)
    addPoints(pointsToAddPerGiftUpgrade)
  })

  chat.on(Events.SUBSCRIPTION, ({ parameters, tags: { displayName } }) => {
    let { months, subPlan } = parameters
    let basePoint = months === 0 ? 2 : 1

    if ( subPlan  === 'Prime' ) {
      console.log(`${getCurrentTime()} SUBSCRIPTION ${displayName} with ${subPlan}`)
      addPoints(basePoint)
    } else {
      subPlan = parseInt(subPlan) / 1000
      console.log(`${getCurrentTime()} SUBSCRIPTION ${displayName} at Tier ${subPlan}`)
      addPoints(basePoint * subPlan)
    }
  })

  chat.on(Events.SUBSCRIPTION_GIFT, ({ parameters, tags: { displayName, username } }) => {
    if (username === channelToObserve.toLowerCase()) return

    let { giftMonths, recipientDisplayName, subPlan } = parameters
    giftMonths = parseInt(giftMonths)
    subPlan = parseInt(subPlan) / 1000

    console.log(`${getCurrentTime()} SUBSCRIPTION_GIFT ${displayName} gifted ${recipientDisplayName} a ${giftMonths} month Tier ${subPlan}`)
    addPoints(pointsToAddPerGiftSub * subPlan * giftMonths)
  })

  chat.on(Events.RESUBSCRIPTION, ({ parameters, tags: { displayName } }) => {
    let { subPlan } = parameters
    if ( subPlan  === 'Prime' ) {
      console.log(`${getCurrentTime()} RESUBSCRIPTION ${displayName} with ${subPlan}`)
      addPoints(pointsToAddPerResubscription)
    } else {
      subPlan = parseInt(subPlan) / 1000
      console.log(`${getCurrentTime()} RESUBSCRIPTION ${displayName} at Tier ${subPlan}`)
      addPoints(pointsToAddPerResubscription * subPlan)
    }
  })

  chat.join(channelToObserve)
}).catch((err) => {
  console.log("ERROR")
  console.log(err)
})

let totalCheered = 0
function bitsPointCalculation(bits){
  let timesReached = 0
  switch(pointsMode){
    default:
    case "off":{
      return
    }
    case "accumulated":{
      totalCheered += bits
      timesReached = Math.floor(totalCheered/bitsToIncreasePoints)
      if(timesReached >= 1){
        addPoints(timesReached*pointsToAddPerCheer)
        totalCheered = totalCheered%bitsToIncreasePoints
      }
      break;
    }
    case "single":{
      timesReached = Math.floor(bits/bitsToIncreasePoints)
      if(timesReached >= 1){
        addPoints(timesReached*pointsToAddPerCheer)
      }
      break;
    }
  }
}

function controlCommand(words){
  switch(words[1].toLowerCase()){
    case("reset"):{
      resetStreaker()
      break
    }
    case("p+"):{
      if(words.length === 2){
        addPoints(1)
      }
      else if(words.length === 3 && !isNaN(words[2])){
        addPoints(Math.floor(words[2]))
      }
      else{
        addPoints(1)
      }
      break
    }
    case("p-"):{
      if(words.length === 2){
        removePoints(1)
      }
      else if(words.length === 3 && !isNaN(words[2])){
        removePoints(Math.floor(words[2]))
      }
      else{
        removePoints(1)
      }
      break
    }
    case("w+"):{
      if(words.length === 2){
        addWheels(1)
      }
      else if(words.length === 3 && !isNaN(words[2])){
        addWheels(Math.floor(words[2]))
      }
      else{
        addWheels(1)
      }
      break
    }
    case("w-"):{
      if(words.length === 2){
        removeWheels(1)
      }
      else if(words.length === 3 && !isNaN(words[2])){
        removeWheels(Math.floor(words[2]))
      }
      else{
        removeWheels(1)
      }
      break
    }


  }

}

const defaultPoints = points
const defaultWheel = wheelCount
const resetStreaker = () =>{
  points = defaultPoints
  wheelCount = defaultWheel
  totalCheered = 0
  handleWriteToFile()
} 

const addPoints = (pointsToAdd) => {
  points += pointsToAdd
  let timesReached = Math.floor(points/goal)
  if (timesReached >= 1) {
    if(chatMessage !== "" || chatMessage !== null || chatMessage !== undefined){
      chat.say(channelToObserve, chatMessage)
    }
    if(soundPath !== "" || soundPath !== null || soundPath !== undefined){
      sound.play(soundPath, soundVolume).catch((err)=>{
        console.log("sound error")
        console.log(err)
      })
    }
    wheelCount += timesReached

    points = points%goal
  }
  handleWriteToFile()
}

const addWheels = (pointsToAdd) => {
  wheelCount += pointsToAdd
  handleWriteToFile()
  return
}
let count = 0
const removePoints = (pointsToAdd) => {
  points -= pointsToAdd
  if (points < 0) {
    wheelCount -= 1
    let left = Math.abs(points)
    points = goal
    if(left > 0){
      count++
      removePoints(left)
    }else{
      point = left
    }
  }
  handleWriteToFile()
}

const removeWheels = (pointsToRemove) => {
  wheelCount -= pointsToRemove
  handleWriteToFile()
}

const ap = addPoints
const aw = addWheels
const rp = removePoints
const rw = removeWheels

const handleWriteToFile = () => {
  if (timeoutHolder) clearTimeout(timeoutHolder)
  timeoutHolder = setTimeout(() => {
    const string = `!WHEEL #${wheelCount} in ${points}/${goal}`
    fs.writeFile('streak.txt', string, function (err) {
      if (err) return console.log(err)
      console.log(`${getCurrentTime()} output "${string}" to streak.txt\n`)
    })
  }, 200)
}

const exit = () => {
  console.log('Bye!')
  process.exit(0)
}

const getCurrentTime = () => {
  const newDate = new Date()
  return newDate.toLocaleTimeString()
}
