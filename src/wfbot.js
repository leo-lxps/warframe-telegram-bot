"use strict";

const Telegraf = require("telegraf"),
  token = require("../token.json"),
  cron = require("node-cron"),
  os = require("os"),
  commandParts = require("telegraf-command-parts"),
  LocalSession = require("telegraf-session-local"),
  Reply = require("./utils/Reply"),
  Util = require("./utils/Util");

const bot = new Telegraf(os.platform() == "win32" ? token.test : token.main);

var sortieSend = false;
const localSession = new LocalSession({ database: "./db/db.json" });
bot.use(localSession.middleware());
bot.use(commandParts());

bot.start(ctx => {
  Util.addUser(ctx);
  ctx.replyWithMarkdown(
    `I made this :),
you are now in my database use /cleardb to clear your entry :)
If you want to have your database entry just ask me :)
monkaDSGVO`,
    Telegraf.Extra.markdown().markup(m => m.keyboard([]))
  );
});
bot.help(ctx => {
  Util.addUser(ctx);
  ctx.replyWithMarkdown(`
  *COMMANDS*:
  /dash - Shows compact alert and sortie information
  /sortie - Get current sortie info
  /alert - Set up filter for alert notification
            \`/alert <keyword> [keywords]\`
  /alerts - Lists current active alerts
  /cetus - Cetus day/night information
  /trader - Void Trader Information
  /events - Shows current events
  /bounties - Lists current Bounties with rewards
  /filter - Lists current alert filter
  /bosses - Lists possible sortie bosses
  /missions - Lists possible sortie missions
  /admins - Lists all admins
  /help - Shows this, duh!
  /drops - Starts inline search
  /optin - Shortcut for subscribing to sortie notification
  /optout - Shortcut for unsubscribing to sortie notification
  /cleardb - !! Clears your database entry, use with care !!
  /time^^ - Save mission time to \`times.json\`
            \`/time <mission>, <mm:ss> [, boss]\`

*INLINE*
  Get mission drops with: \`@BerndDasBot <Search>\`

*PSST*
  Find some hidden easter eggs. ;)

*LEGEND*
\`\`\`
  ^^: admin only
  <>: required
  []: optional
\`\`\``);
});

bot.command("sortie", ctx => {
  Util.addUser(ctx);
  Util.getSortie(sortie => {
    Reply.sortie(ctx, sortie);
  });
});
bot.command("alert", ctx => {
  Util.addUser(ctx);
  Reply.alert(ctx, bot);
});
bot.command("notify", ctx => {
  Util.addUser(ctx);
  Reply.alert(ctx, bot);
});
bot.command("cleardb", ctx => {
  Util.addUser(ctx);
  Reply.clear(ctx);
});
bot.command("optin", ctx => {
  Util.addUser(ctx);
  Reply.optIn(ctx);
  ctx.replyWithMarkdown(
    "*Added you to Sortie list!* \n You'll get the new Sortie every day"
  );
});
bot.command("optout", ctx => {
  Util.addUser(ctx);
  Reply.optOut(ctx);
  ctx.replyWithMarkdown(
    "*Removed you from the Sortie list!* \n You'll no longer get the new Sortie every day"
  );
});
bot.command("time", ctx => {
  Util.addUser(ctx);
  Reply.time(ctx);
});
bot.command("missions", ctx => {
  Util.addUser(ctx);
  Reply.listMissions(ctx);
});
bot.command("mission", ctx => {
  Util.addUser(ctx);
  Reply.listMissions(ctx);
});
bot.command("bosses", ctx => {
  Util.addUser(ctx);
  Reply.listBosses(ctx);
});
bot.command("boss", ctx => {
  Util.addUser(ctx);
  Reply.listBosses(ctx);
});
bot.command("filter", ctx => {
  Util.addUser(ctx);
  Reply.listAlert(ctx);
});
bot.command("filters", ctx => {
  Util.addUser(ctx);
  Reply.listAlert(ctx);
});
bot.command("alerts", ctx => {
  Util.addUser(ctx);
  Reply.checkAlert(ctx.session.alertItems, ctx.from.id, bot, true);
});
bot.command("cetus", ctx => {
  Util.addUser(ctx);
  Reply.cetus(ctx);
});
bot.command("trader", ctx => {
  Util.addUser(ctx);
  Reply.trader(ctx);
});
bot.command("dash", ctx => {
  Util.addUser(ctx);
  Reply.dash(ctx);
});
bot.command("dashboard", ctx => {
  Util.addUser(ctx);
  Reply.dash(ctx);
});
bot.command("events", ctx => {
  Util.addUser(ctx);
  Reply.events(ctx);
});
bot.command("event", ctx => {
  Util.addUser(ctx);
  Reply.events(ctx);
});
bot.command("bounties", ctx => {
  Util.addUser(ctx);
  Reply.bounties(ctx);
});
bot.command("bounty", ctx => {
  Util.addUser(ctx);
  Reply.bounties(ctx);
});
bot.command("drops", ctx => {
  Util.addUser(ctx);
  Reply.drops(ctx);
});
bot.command("drop", ctx => {
  Util.addUser(ctx);
  Reply.drops(ctx);
});
bot.command("items", ctx => {
  Util.addUser(ctx);
  Reply.drops(ctx);
});
bot.command("item", ctx => {
  Util.addUser(ctx);
  Reply.drops(ctx);
});
bot.command("save", ctx => {
  Util.getInfo(alerts => {
    Util.saveAlerts(alerts);
  });
  Util.getSortie(sortie => {
    Util.saveSortie(sortie);
  });
  Util.getTrader(trader => {
    Util.saveTrader(trader);
  });
});

// drops
bot.on("inline_query", ctx => {
  Util.addUser(ctx);
  Reply.query(ctx);
});
// keyboard actions
bot.on("callback_query", ctx => {
  Util.addUser(ctx);
  Reply.callback(ctx);
});

bot.startPolling();

// cron update 18 o'clock
cron.schedule(
  "*/30 1-5 18 * * *",
  function() {
    var now = Util.getNow();
    Util.getSessions(sessions => {
      if (sessions.length < 1) return;
      const optIntUserCount = sessions.reduce(
        (sum, s) => (s.data.user.optIn ? ++sum : sum),
        0
      );
      console.log(now, "Number of opt-in users:", optIntUserCount);
      if (optIntUserCount < 1) return;

      Util.getSortie(sortie => {
        if (!sortie) return;
        if (sortie.expired) {
          sortieSend = false;
          return;
        } else if (!sortieSend) {
          sortieSend = true;
          console.log(now, "Sending new Sortie to:");
          sessions.forEach(session => {
            const user = session.data.user;
            if (user.optIn) {
              console.log(now, " | ", user.username);
              Reply.sortie(0, sortie, 2, user.id, bot);
            }
          });
          Util.saveSortie(sortie);
        } else {
          console.log(now, "New Sortie was send");
        }
      });
    });
  },
  true
);

cron.schedule(
  "*/2 * * * *",
  function() {
    try {
      Util.getSessions(sessions => {
        if (sessions.length < 1) return;
        sessions.forEach(session => {
          if (session.data.alertItems && session.data.user) {
            console.log(
              Util.getNow(),
              "Checking alerts for: ",
              session.data.user.username
            );
            Reply.checkAlert(
              session.data.alertItems,
              session.data.user.id,
              bot
            );
          }
        });
        Util.getInfo(alerts => {
          alerts.forEach(al => Util.addNotified(al.id));
          Util.saveAlerts(alerts);
        });
      });
    } catch (err) {
      console.log(Util.getNow(), err);
    }
  },
  true
);

cron.schedule(
  "* * 24 * *",
  function() {
    if (Util.getNotified().length > 100) {
      console.log(Util.getNow(), "cleaning old alerts...");
      Util.notified.splice(0, 50);
    }
  },
  true
);

cron.schedule(
  "5 15 * * *",
  function() {
    Util.getSessions(sessions => {
      if (sessions.length < 1) return;
      Util.getTrader(trader => {
        if (!trader) return;
        if (trader.active) {
          sessions.forEach(session => {
            if (session.data.user) {
              if (session.data.user.optIn) {
                Reply.newTrader(trader, session.data.user.id, bot);
              }
            }
          });
          Util.saveTrader(trader);
        } else {
          console.log(Util.getNow(), "Trader not active");
        }
      });
    });
  },
  true
);
