import { ReactiveAggregate } from 'meteor/tunguska:reactive-aggregate'
import Timecards from '../timecards.js'
import Projects from '../../projects/projects.js'
import { periodToDates } from '../../../utils/periodHelpers.js'
import { checkAuthentication, getProjectListById, buildDetailedTimeEntriesForPeriodSelector } from '../../../utils/server_method_helpers.js'

Meteor.publish('projectTimecards', function projectTimecards({ projectId, period, userId }) {
  check(projectId, String)
  check(period, String)
  check(userId, String)
  checkAuthentication(this)
  const projectList = getProjectListById(projectId)

  if (period && period !== 'all') {
    const { startDate, endDate } = periodToDates(period)
    if (userId === 'all') {
      return Timecards.find({
        projectId: { $in: projectList },
        date: { $gte: startDate, $lte: endDate },
      })
    }
    return Timecards.find({
      projectId: { $in: projectList },
      userId,
      date: { $gte: startDate, $lte: endDate },
    })
  }
  if (userId === 'all') {
    return Timecards.find({ projectId: { $in: projectList } })
  }
  return Timecards.find({ projectId: { $in: projectList }, userId })
})

Meteor.publish('periodTimecards', function periodTimecards({ startDate, endDate, userId }) {
  check(startDate, Date)
  check(endDate, Date)
  check(userId, String)
  checkAuthentication(this)
  const projectList = Projects.find(
    { $or: [{ userId: this.userId }, { public: true }, { team: this.userId }] },
    { $fields: { _id: 1 } },
  ).fetch().map((value) => value._id)

  if (userId === 'all') {
    return Timecards.find({
      projectId: { $in: projectList },
      date: { $gte: startDate, $lte: endDate },
    })
  }
  return Timecards.find({
    projectId: { $in: projectList },
    userId,
    date: { $gte: startDate, $lte: endDate },
  })
})
Meteor.publish('userTimeCardsForPeriodByProjectByTask', function periodTimecards({ projectId, startDate, endDate }) {
  check(startDate, Date)
  check(endDate, Date)
  check(projectId, String)
  checkAuthentication(this)
  return ReactiveAggregate(this, Timecards, [
    {
      $match: {
        projectId,
        userId: this.userId,
        date: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: { $concat: ['$projectId', '|', '$task'] },
        entries: { $push: '$$ROOT' },
      },
    },
  ], { clientCollection: 'clientTimecards' })
})
// Meteor.publish('dailyTimeCardsForUserByPeriod', function getDailyTimecards({
//   projectId,
//   userId,
//   period,
//   customer,
//   limit,
//   page,
// }) {
//   check(projectId, String)
//   check(period, String)
//   check(userId, String)
//   check(customer, String)
//   check(limit, Number)
//   check(page, Match.Maybe(Number))
//   checkAuthentication(this)
//   const aggregationSelector = buildDailyHoursSelector(projectId, period, userId, customer, limit, page)
//   // const dailyHours = Promise.await(Timecards.rawCollection().aggregate(aggregationSelector))
//   const totalEntries = Promise.await(Timecards.rawCollection()
//     .aggregate(buildDailyHoursSelector(projectId, period, userId, customer, 0))
//     .toArray()).length
//   aggregationSelector.push({ $addFields: { totalEntries } })
//   aggregationSelector.splice(1, 1)
//   return ReactiveAggregate(this, Timecards, aggregationSelector, { clientCollection: 'clientTimecards' })
// })
// getTotalHoursForPeriod({
//   projectId,
//   userId,
//   period,
//   customer,
//   limit,
//   page,
// }) {
//   check(projectId, String)
//   check(period, String)
//   check(userId, String)
//   check(customer, String)
//   check(limit, Number)
//   check(page, Match.Maybe(Number))
//   checkAuthentication(this)
//   const aggregationSelector = buildTotalHoursForPeriodSelector(projectId, period, userId, customer, limit, page)
//   const totalHoursObject = {}
//   const totalEntries = Promise.await(Timecards.rawCollection()
//     .aggregate(buildTotalHoursForPeriodSelector(projectId, period, userId, customer, 0))
//     .toArray()).length
//   const totalHours = Promise.await(Timecards.rawCollection().aggregate(aggregationSelector)
//     .toArray()).map(totalHoursForPeriodMapper)
//   totalHoursObject.totalHours = totalHours
//   totalHoursObject.totalEntries = totalEntries
//   return totalHoursObject
// },
// getWorkingHoursForPeriod({
//   projectId,
//   userId,
//   period,
//   limit,
//   page,
// }) {
//   check(projectId, String)
//   check(period, String)
//   check(userId, String)
//   check(limit, Number)
//   check(page, Match.Maybe(Number))
//   const aggregationSelector = buildworkingTimeSelector(projectId, period, userId, limit, page)
//   const totalEntries = Promise.await(
//     Timecards.rawCollection()
//       .aggregate(buildworkingTimeSelector(projectId, period, userId, 0)).toArray(),
//   ).length
//   const workingHoursObject = {}
//   workingHoursObject.totalEntries = totalEntries
//   const workingHours = Promise.await(Timecards.rawCollection().aggregate(aggregationSelector)
//     .toArray()).map(workingTimeEntriesMapper)
//   workingHoursObject.workingHours = workingHours
//   return workingHoursObject
// },
// })
Meteor.publish('myTimecardsForDate', function myTimecardsForDate({ date }) {
  check(date, String)
  checkAuthentication(this)
  return Timecards.find({
    userId: this.userId,
    date: new Date(date),
  })
})
Meteor.publish('getDetailedTimeEntriesForPeriodCount', function getDetailedTimeEntriesForPeriodCount({
  projectId,
  userId,
  customer,
  period,
  search,
}) {
  check(projectId, String)
  check(userId, String)
  check(customer, String)
  check(period, String)
  check(search, Match.Maybe(String))
  let count = 0
  let initializing = true
  const selector = buildDetailedTimeEntriesForPeriodSelector({
    projectId, search, customer, period, userId,
  })
  const handle = Timecards.find(selector[0], selector[1]).observeChanges({
    added: () => {
      count += 1

      if (!initializing) {
        this.changed('counts', projectId, { count })
      }
    },
    removed: () => {
      count -= 1
      this.changed('counts', projectId, { count })
    },
  })

  initializing = false
  this.added('counts', projectId, { count })
  this.ready()

  this.onStop(() => handle.stop())
})

Meteor.publish('getDetailedTimeEntriesForPeriod', function getDetailedTimeEntriesForPeriod({
  projectId,
  userId,
  customer,
  period,
  search,
  sort,
  limit,
  page,
}) {
  check(projectId, String)
  check(userId, String)
  check(customer, String)
  check(period, String)
  check(search, Match.Maybe(String))
  check(sort, Match.Maybe(Object))
  if (sort) {
    check(sort.column, Number)
    check(sort.order, String)
  }
  check(limit, Number)
  check(page, Match.Maybe(Number))
  checkAuthentication(this)
  const selector = buildDetailedTimeEntriesForPeriodSelector({
    projectId, search, customer, period, userId, limit, page, sort,
  })
  return Timecards.find(selector[0], selector[1])
})
Meteor.publish('singleTimecard', function singleTimecard(_id) {
  check(_id, String)
  checkAuthentication(this)
  const timecard = Timecards.findOne({ _id })
  const project = Projects.findOne({ _id: timecard.projectId })
  if (!this.userId || (!Timecards.findOne({ userId: this.userId }) && !project.public)) {
    return this.ready()
  }
  return Timecards.find({ _id })
})
