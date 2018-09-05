const admins = require("../../admins.json") || [],
  request = require("request"),
  fs = require("fs"),
  Items = require("warframe-items"),
  moment = require("moment");

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
    fs.readFile("./db/times.json", function(err, contents) {
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
    fs.readFile("./db/db.json", function(err, contents) {
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
  saveNotifiedDB: alertIdArr => {
    fs.readFile("./db/notified.json", function(err, contents) {
      if (err) {
        if (err.code != "ENOENT") {
          console.warn(err);
        } else {
          fs.writeFile(
            "./db/notified.json",
            JSON.stringify(alertIdArr),
            err => {
              throw err;
            }
          );
          return;
        }
      }
      var notified = [];
      try {
        notified = JSON.parse(contents);
      } catch (err) {
        console.log(Util.getNow(), "Not a valid json", contents);
      }
      notified = notified.concat(alertIdArr);
      fs.writeFile("./db/notified.json", JSON.stringify(notified));
    });
  },
  getNotifiedDB: Callback => {
    fs.readFile("./db/notified.json", function(err, contents) {
      if (err) {
        if (err.code == "ENOENT") {
          Callback([]);
        } else console.warn(err);
      } else {
        var notified = [];
        try {
          notified = JSON.parse(contents);
        } catch (err) {
          console.log(Util.getNow(), "Not a valid json", contents);
        }
        Callback(notified);
      }
    });
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
  getAlerts: (Callback, ignoreNotified) => {
    if (!Callback) console.log("getAlerts: No Callback");
    const urlAlerts = "https://api.warframestat.us/pc/alerts";
    const urlInvasions = "https://api.warframestat.us/pc/invasions";
    const notified = Util.getNotified();
    var found = [];
    request(
      {
        url: urlAlerts,
        json: true
      },
      function(error, response, body) {
        if (error) console.warn(error);
        if (!body) return;
        const alerts = body;
        try {
          alerts.forEach(alert => {
            if (!notified.includes(alert.id) || ignoreNotified) {
              if (!alert.expired) {
                var str =
                  "*" +
                  alert.mission.reward.asString +
                  "*\n\t\t\t_" +
                  alert.eta +
                  "_\t\t\t\t`" +
                  alert.mission.type +
                  (alert.mission.nightmare ? " (Nightmare)" : "") +
                  "`\n";
                var msg = str;
                // +
                // "\t\t\t\t`" +
                // "Alert - " +
                // alert.mission.type +
                // (alert.mission.nightmare ? " (Nightmare)" : "") +
                // "`\n";
                found.push({
                  item: alert.mission.reward.itemString,
                  type: "Alert",
                  id: alert.id,
                  message: msg
                });
              }
            }
          });
        } catch (err) {
          console.log("error:", err, "with alerts: ", alerts);
        }

        request(
          {
            url: urlInvasions,
            json: true
          },
          function(error, response, body) {
            if (error) console.warn(error);
            if (!body) return;
            const invasions = body;
            invasions.forEach(invasion => {
              if (!notified.includes(invasion.id) || ignoreNotified) {
                if (!invasion.completed) {
                  var attackStr = invasion.attackerReward.asString;
                  var defendStr = invasion.defenderReward.asString;
                  var bothMsg =
                    "*" +
                    defendStr +
                    (attackStr ? " | " + attackStr : "") +
                    "*\n";
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
                    id: invasion.id,
                    message: msg
                  });
                }
              }
            });

            Callback(found);
          }
        );
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
        return Util.translateWeapon(item);
      case "Mods":
        return item; //TODO mod translation
      case "Warframes":
      case "Pets":
      case "Sentinels":
        return Util.translateWarframe(item);
      default:
        break;
    }
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
    let abilities = Util.translateAbilities(warframe.abilities);
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
      let name = "`|`\t\t\t" + ability.name + ": ";
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
    let damage = Util.translateDamage(weapon.damageTypes);
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
    let title = "*Patchlog:* \n";
    let name = patchlog.name;
    let additions = patchlog.additions.replace("`", "'");
    let changes = patchlog.changes.replace("`", "'");
    let fixes = patchlog.fixes.replace("`", "'");
    let msg =
      title +
      (additions ? "`|`\t\t\tAdditions: _" + additions + "_\n" : "") +
      (changes ? "`|`\t\t\tChanges: _" + changes + "_\n" : "") +
      (fixes ? "`|`\t\t\tFixes: _" + fixes + "_\n" : "");
    return msg;
  },
  generateData: () => {
    const frames = Array.from(new Items(["Warframes"]));
    var data = [];
    var ind = 0;
    frames.forEach(f => {
      if (f.health && f.type == "Warframe") {
        if (f.name == "Excalibur Umbra") {
          console.log(f);
        }
        data.push({
          warframe: f.name,
          index: ind,
          health: f.health,
          shield: f.shield,
          countPatches: f.patchlogs ? f.patchlogs.length : 0,
          patches: f.patchlogs ? f.patchlogs.map(p => p.date) : [],
          sprint: f.sprint,
          power: f.power,
          stamina: f.stamina,
          armor: f.armor,
          buildPrice: f.buildPrice,
          buildTime: f.buildTime,
          tradable: f.tradable ? 1 : 0
        });
        ind++;
      }
    });
    // data.sort((a, b) => a.health - b.health);
    fs.writeFile("./stats/data.json", JSON.stringify(data), err =>
      console.log(err)
    );
  }
};

module.exports = Util;
