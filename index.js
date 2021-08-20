const fs = require('fs')
const TwitchJs = require('twitch-js').default
let timeoutHolder
const { Events } = TwitchJs.Chat
const { chat } = new TwitchJs({ log: { level: 'silent' } })

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
let channelToObserve = 'aneternalenigma'

// set to whatever number you want to be per wheel, ( 0 / 20 )
let goal = 20

// you can manually set the number of points already earned if you need for the next start of the script
let points = 0

// you can manually set the number of wheels already earned if you need for the next start of the script
let wheelCount = 1

// points added per upgraded gift subscription
let pointsToAddPerGiftUpgrade = 2

// points added per gifted subscription
// total point value is multiplied by the sub tier
// and number of gifted months
// eg: tier 3 at 2 months would be `pointsToAddPerGiftSub * 3 * 2`
let pointsToAddPerGiftSub = 2

// points added per resubscription
// total point value is multiplied by the sub tier
// eg: tier 2 would be `pointsToAddPerResubscription * 2`
let pointsToAddPerResubscription = 1

chat.connect().then(() => {
  console.log(`
    ************************************\n
    Remember to reset the wheel counter!\n
    ************************************\n
  `)
  console.log(`\n${getCurrentTime()} Joining channel: ${channelToObserve} \n`)
  handleWriteToFile()
  chat.removeAllListeners()
  chat.on(Events.PARSE_ERROR_ENCOUNTERED, () => {})

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
})

const addPoints = (pointsToAdd) => {
  points += pointsToAdd
  if (points >= goal) {
    wheelCount += 1
    points -= goal
  }
  handleWriteToFile()
}

const addWheels = (pointsToAdd) => {
  wheelCount += pointsToAdd
  handleWriteToFile()
  return
}

const removePoints = (pointsToAdd) => {
  points -= pointsToAdd
  if (points < 0) {
    wheelCount -= 1
    points += goal
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
