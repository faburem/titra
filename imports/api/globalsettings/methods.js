import { defaultSettings, Globalsettings } from './globalsettings.js'
import { checkAdminAuthentication } from '../../utils/server_method_helpers.js'

Meteor.methods({
  updateGlobalSettings(settingsArray) {
    checkAdminAuthentication(this)
    check(settingsArray, Array)
    for (const setting of settingsArray) {
      check(setting, Object)
      check(setting.name, String)
      check(setting.value, Match.OneOf(String, Number, Boolean))
      Globalsettings.update({ name: setting.name }, { $set: { value: setting.value } })
    }
  },
  resetSettings() {
    checkAdminAuthentication(this)
    for (const setting of defaultSettings) {
      Globalsettings.remove({ name: setting.name })
      Globalsettings.insert(setting)
    }
  },
})