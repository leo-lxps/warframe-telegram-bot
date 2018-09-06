const admins = require("../../admins.json") || [],
  request = require("request"),
  fs = require("fs"),
  Items = require("warframe-items"),
  moment = require("moment");

const timesFile = "./db/times.json";
const dbFile = "./db/db.json";

const Util = {
  notified: [],
  slapped: 0,
  slap: () => {
    Util.slapped++;
  },
  getSortie: Callback => {
    const url = "https://api.warframestat.us/pc/sortie";
    request(
      {
        url: url,
        json: true
      },
      function(error, response, body) {
        if (error) {
          console.warn(error);
          return;
        }
        Callback(body);
      }
    );
  },
  getTimes: Callback => {
    fs.readFile(timesFile, function(err, contents) {
      if (err) {
        if (err.code == "ENOENT") {
          Callback([]);
        } else console.warn(err);
      } else {
        var times = [];
        try {
          times = JSON.parse(contents);
        } catch (err) {
          console.log(Util.getNow(), "Not a valid json", contents);
        }
        Callback(times);
      }
    });
  },
  getAvgTimes: Callback => {
    var avgMissionTimes = [];
    Util.getTimes(times => {
      times.forEach(time => {
        let found = avgMissionTimes.find(a => a.mission == time.mission);
        if (!found) {
          avgMissionTimes.push({
            mission: time.mission,
            seconds: time.minutes * 60 + time.seconds,
            measurements: 1,
            boss: time.boss
          });
        } else {
          if (Util.isAssAss(found.mission)) {
            let foundBoss = avgMissionTimes.find(a => a.boss == time.boss);
            if (!foundBoss) {
              avgMissionTimes.push({
                mission: time.mission,
                seconds: time.minutes * 60 + time.seconds,
                measurements: 1,
                boss: time.boss
              });
            } else {
              foundBoss.measurements++;
              foundBoss.seconds += time.minutes * 60 + time.seconds;
            }
          } else {
            found.measurements++;
            found.seconds += time.minutes * 60 + time.seconds;
          }
        }
      });
      avgMissionTimes = avgMissionTimes.map(am => {
        var avgSec = am.seconds / am.measurements;
        var minutes = Math.floor(avgSec / 60);
        var seconds = Math.floor(avgSec - minutes * 60);
        return {
          mission: am.mission,
          minutes: minutes,
          seconds: seconds,
          boss: am.boss
        };
      });

      console.log(avgMissionTimes);
      Callback(avgMissionTimes);
    });
  },
  formatTime: sec => {
    return moment(sec * 1000).format("m:ss");
  },
  getSessions: Callback => {
    fs.readFile(dbFile, function(err, contents) {
      if (err) {
        console.warn(err);
        Callback([]);
      } else {
        Callback(
          JSON.parse(contents).sessions.filter(
            u => u.id.split(":")[0] == u.id.split(":")[1]
          )
        );
      }
    });
  },
  setTemp: ids => {
    Util.tempNot = ids;
  },
  addNotified: id => {
    Util.notified.push(id);
  },
  getNotified: () => {
    return Util.notified;
  },
  isAssAss: mission => {
    return mission.toUpperCase() == "ASSASSINATION";
  },
  parseTime: time => {
    /** time in format mm:ss with mm:(0-inf) and ss:(0-59) */
    var timeRx = new RegExp("^(([0-5]?[0-9])+:([0-5]?[0-9]))$");
    return timeRx.test(time);
  },
  isAdmin: ctx => {
    var b = false;
    admins.forEach(admin => {
      if (admin.username == ctx.message.from.username) {
        b = true;
      }
    });
    return b;
  },
  getNow: () => {
    return "[" + moment().format("HH:mm:ss") + "]";
  },
  addUser: (ctx, optIn) => {
    var now = Util.getNow();
    ctx.session.user = ctx.session.user || null;
    ctx.session.alertItems = ctx.session.alertItems || [];
    var user = ctx.session.user;
    var isOptIn = optIn == undefined ? (user ? user.optIn : false) : optIn;
    if (ctx.session.user == null) {
      console.log(now, "Added user:", ctx.from.username);
      ctx.session.user = {
        username: ctx.from.username,
        id: ctx.from.id,
        optIn: isOptIn
      };
    } else {
      ctx.session.user.optIn = isOptIn;
    }
    Util.getSortie(
      sortie => (ctx.session.sortie = sortie || ctx.session.sortie)
    );
  },
  getTrader: Callback => {
    const url = "https://api.warframestat.us/pc/voidTrader";
    request(
      {
        url: url,
        json: true
      },
      function(error, response, body) {
        if (error) {
          console.warn(error);
          return;
        }
        Callback(body);
      }
    );
  },
  getEvents: Callback => {
    const url = "https://api.warframestat.us/pc/events";
    request(
      {
        url: url,
        json: true
      },
      function(error, response, body) {
        if (error) {
          console.warn(error);
          return;
        }
        Callback(body);
      }
    );
  },
  getDrops: (query, Callback) => {
    const url = "https://api.warframestat.us/drops/search/";

    request(
      {
        url: url + query,
        json: true
      },
      function(error, response, body) {
        if (error) console.warn(err);
        if (!body) return;
        Callback(body);
      }
    );
  },
  getAllDrops: Callback => {
    const url = "https://api.warframestat.us/drops";

    request(
      {
        url: url,
        json: true
      },
      function(error, response, body) {
        if (error) console.warn(err);
        if (!body) return;

        Callback(body);
      }
    );
  },
  getWeapons: (query, Callback) => {
    const url = "https://api.warframestat.us/weapons/search/";

    request(
      {
        url: url + query,
        json: true
      },
      function(error, response, body) {
        if (error) console.warn(err);
        if (!body) return;

        Callback(body);
      }
    );
  },
  getInfo: (Callback, ignoreNotified, types) => {
    Util.getAlerts(
      alerts => {
        Util.getInvasions(
          invasions => {
            Util.getBounties(
              bounties => {
                const all = alerts.concat(invasions).concat(bounties);
                Callback(all);
              },
              ignoreNotified,
              types
            );
          },
          ignoreNotified,
          types
        );
      },
      ignoreNotified,
      types
    );
  },
  getAlerts: (Callback, ignoreNotified, types) => {
    if (!Callback) console.log("getAlerts: No Callback function");
    if (types) {
      if (!types.includes("Alert")) {
        Callback([]);
        return;
      }
    }
    const urlAlerts = "https://api.warframestat.us/pc/alerts";
    const notified = Util.getNotified();
    var found = [];
    request(
      {
        url: urlAlerts,
        json: true
      },
      function(error, response, body) {
        if (error) console.warn(error);
        if (!body) {
          Callback([]);
          return;
        }
        const alerts = body;
        const title = "\n*ALERTS:*\n";
        try {
          alerts.forEach(alert => {
            if (!notified.includes(alert.id) || ignoreNotified) {
              if (!alert.expired) {
                var msg =
                  "*" +
                  alert.mission.reward.asString +
                  "*\n\t\t\t_" +
                  alert.eta +
                  "_\t\t\t\t`" +
                  alert.mission.type +
                  (alert.mission.nightmare ? " (Nightmare)" : "") +
                  "`\n";
                found.push({
                  item: alert.mission.reward.itemString,
                  title: title,
                  type: "Alert",
                  id: alert.id,
                  message: msg
                });
              }
            }
          });
          Callback(found);
        } catch (err) {
          console.log("error:", err, "with alerts: ", alerts);
        }
      }
    );
  },
  getInvasions: (Callback, ignoreNotified, types) => {
    if (!Callback) console.log("getInvasions: No Callback function");
    if (types) {
      if (!types.includes("Invasion")) {
        Callback([]);
        return;
      }
    }
    const urlInvasions = "https://api.warframestat.us/pc/invasions";
    const notified = Util.getNotified();
    var found = [];
    request(
      {
        url: urlInvasions,
        json: true
      },
      function(error, response, body) {
        if (error) console.warn(error);
        if (!body) {
          Callback([]);
          return;
        }
        const title = "\n*INVASIONS:*\n";
        const invasions = body;
        invasions.forEach(invasion => {
          if (!notified.includes(invasion.id) || ignoreNotified) {
            if (!invasion.completed) {
              var attackStr = invasion.attackerReward.asString;
              var defendStr = invasion.defenderReward.asString;
              var bothMsg =
                "*" + defendStr + (attackStr ? " | " + attackStr : "") + "*\n";
              var msg =
                bothMsg +
                "\t\t\t\t_" +
                invasion.eta +
                (invasion.completion
                  ? " (" + parseInt(invasion.completion) + "%)"
                  : "") +
                "_\t\t\t`" +
                invasion.desc +
                "`\n";

              var len = 29;
              var att = len * (parseInt(invasion.completion) / 100);
              var def = len * (1 - parseInt(invasion.completion) / 100);
              var progress = "`" + "▀".repeat(att) + "▄".repeat(def) + "`";
              // msg = msg + progress + "\n";

              invasion.desc + "`\n";
              found.push({
                type: "Invasion",
                title: title,
                id: invasion.id,
                message: msg
              });
            }
          }
        });
        Callback(found);
      }
    );
  },
  getBounties: (Callback, ignoreNotified, types) => {
    if (!Callback) console.log("getBounties: No Callback function");
    if (types) {
      if (!types.includes("Bounty")) {
        Callback([]);
        return;
      }
    }
    var url = "https://api.warframestat.us/pc/syndicateMissions";
    const notified = Util.getNotified();
    var found = [];
    request(
      {
        url: url,
        json: true
      },
      function(error, response, body) {
        if (error) console.warn(error);
        if (!body) {
          Callback([]);
          return;
        }
        var bounty = body.filter(s => s.syndicate == "Ostrons")[0];
        if (bounty) {
          if (!notified.includes(bounty.id) || ignoreNotified) {
            let title = "*BOUNTIES:*\n\t\t\t_" + bounty.eta + "_";
            bounty.jobs.forEach((b, i) => {
              let type =
                "*" +
                b.type +
                "*: " +
                b.enemyLevels.join("-") +
                "\n\t\t\t_" +
                bounty.eta +
                "_\n";
              let pool = b.rewardPool.join(", ");
              found.push({
                item: pool,
                type: "Bounty",
                id: bounty.id,
                title: title,
                message: type + "`" + pool + "`\n"
              });
            });
          }
        }
        Callback(found);
      }
    );
  },
  getArcanes: Callback => {
    var url = "https://api.warframestat.us/arcanes";
    request(
      {
        url: url,
        json: true
      },
      function(error, response, body) {
        if (error) console.warn(error);
        if (!body) return;
      }
    );
  },
  getItems: query => {
    const items = new Items();
    var queries = query
      .split(",")
      .filter(q => q != "")
      .map(q => q.trim());
    var types = [];
    let found = Array.from(items).filter(i => {
      if (!types.includes(i.category)) {
        types.push(i.category);
      }
      var b = false;
      queries.forEach(query => {
        if (i.name.toUpperCase().includes(query.toUpperCase())) {
          if (i.name.charAt(0) != "/" && i.name != "[Ph]") {
            b = true;
          }
        }
      });
      return b;
    });
    return found;
  },
  translateItem: item => {
    switch (item.category) {
      case "Archwing":
      case "Secondary":
      case "Melee":
      case "Primary":
        return Util.translateWeapon(item); //TODO mod translation
      case "Warframes":
      case "Pets":
      case "Sentinels":
        return Util.translateWarframe(item);
      default:
        return Util.translateOther(item);
    }
  },
  translateOther: item => {
    var info = item
      ? (item.description
          ? "\n\t\t\t_" + item.description.replace(/\<([^>]+)\>/g, "") + "_"
          : "") +
        (item.polarity
          ? "\n\t\t\tPolarity: `" + item.polarity.replace("_", " ") + "`"
          : "") +
        (item.baseDrain && item.fusionLimit
          ? "\n\t\t\tDrain: `" + item.baseDrain + "-" + item.fusionLimit + "`"
          : "")
      : "";

    var drops = item.drops
      ? item.drops
          .splice(0, 5)
          .reduce(
            (str, d) =>
              (str +=
                d.type +
                ": `" +
                d.location +
                "`\n" +
                d.rarity +
                " (_" +
                d.chance * 100 +
                "%_)\n"),
            ""
          )
      : "";

    return "*" + item.name + "*" + info + "\n" + drops;
  },
  translateWarframe: warframe => {
    let name = warframe.name + "\n";
    let description = "_" + warframe.description + "_\n";
    let health = "Health: `" + warframe.health + "`\n";
    let shield = "Shield: `" + warframe.shield + "`\n";
    let armor = "Armor: `" + warframe.armor + "`\n";
    let power = "Energy: `" + warframe.power + "`\n";
    let MR = "Mastery Requirement: `" + warframe.masteryReq + "`\n";
    let sex =
      warframe.name == "Nezha"
        ? "It's a Trap!\n"
        : "Gender: " + warframe.sex + "\n";
    let trade = warframe.tradable
      ? "*" + warframe.name + " is tradable!*\n"
      : "";
    let vaulted = warframe.vaulted
      ? "*" + warframe.name + " is vaulted!*\n"
      : "";
    let abilities = warframe.abilities
      ? Util.translateAbilities(warframe.abilities)
      : "";
    let sprint = "Sprint Speed: `" + warframe.sprint + "`\n";
    let wikiUrl = "[" + warframe.name + "](" + warframe.wikiaUrl + ")\n";

    return (
      name +
      description +
      health +
      shield +
      armor +
      power +
      abilities +
      sprint +
      sex +
      MR +
      trade +
      vaulted +
      wikiUrl
    );
  },
  translateAbilities: abilities => {
    let msg = "*Abilities:*\n";
    abilities.forEach(ability => {
      let name = "`|`\t\t\t*" + ability.name + "*: ";
      let description = "_" + ability.description + "_\n";
      msg += name + description;
    });
    return msg;
  },
  translateWeapon: weapon => {
    let name = "*" + weapon.name + "*\n";
    let type =
      weapon.category + " - " + weapon.type + " (" + weapon.trigger + ")\n";
    let description = "_" + weapon.description + "_\n";
    let magazine = "Magazine: `" + weapon.magazineSize + "`\n";
    let reload = "Reload Time: `" + weapon.reloadTime + "`\n";
    let dps = "*DPS*: `" + weapon.damagePerSecond + "`\n";
    let trigger = "Trigger: " + weapon.trigger + "\n";
    let accuracy = "Accuracy: `" + weapon.accuracy + "`\n";
    let CC =
      "Critical Change: `" + Math.round(weapon.criticalChance * 100) + "%`\n";
    let CM = "Critical Multiplier: `" + weapon.criticalMultiplier + "x`\n";
    let SC = "Status Chance: `" + Math.round(weapon.procChance * 100) + "%`\n";
    let FR = "Fire Rate: `" + Math.round(weapon.fireRate * 100) / 100 + "`\n";
    let MR = "Mastery Requirement: `" + weapon.masteryReq + "`\n";
    let disposition = "Riven Disposition: `" + weapon.disposition + "`\n";
    let trade = weapon.tradable ? "*Weapon is tradable!*\n" : "";
    let vaulted = weapon.vaulted ? "*Weapon is vaulted!*\n" : "";
    let latestPatch = weapon.patchlogs
      ? Util.translatePatchlog(weapon.patchlogs[0]) + "\n"
      : "";
    let damage = weapon.damageTypes
      ? Util.translateDamage(weapon.damageTypes)
      : "";
    let wikiUrl = "[" + weapon.name + "](" + weapon.wikiaUrl + ")\n";

    let message =
      name +
      type +
      description +
      magazine +
      FR +
      CC +
      CM +
      SC +
      damage +
      dps +
      disposition +
      trade +
      vaulted +
      latestPatch +
      wikiUrl;

    return message;
  },
  translateDamage: damageTypes => {
    var types = Object.keys(damageTypes);
    var msg = "Damage: \n";
    types.forEach(type => {
      msg +=
        "`|`\t\t\t" +
        type.charAt(0).toUpperCase() +
        type.slice(1) +
        ": `" +
        damageTypes[type] +
        "`\n";
    });
    return msg;
  },
  translatePatchlog: patchlog => {
    if (!patchlog) return;
    let title = "*Latest Patchlog:* \n";
    let name = patchlog.name;
    let additions = patchlog.additions.replace("`", "'");
    let changes = patchlog.changes.replace("`", "'");
    let fixes = patchlog.fixes.replace("`", "'");
    let msg =
      title +
      (additions ? "`|`\t\t\t*Additions*: _" + additions + "_\n" : "") +
      (changes ? "`|`\t\t\t*Changes*: _" + changes + "_\n" : "") +
      (fixes ? "`|`\t\t\t*Fixes*: _" + fixes + "_\n" : "");
    return msg;
  }
};

module.exports = Util;
