import _ from 'lodash'

export function getId (instance, checkWithin) {
  if (_.isObject(instance) && !_.isArray(instance)) {
    if (!checkWithin) checkWithin = ['id', 'code']
    for (let i = 0; i < checkWithin.length; i++) {
      if (instance.hasOwnProperty(checkWithin[i])) return instance[checkWithin[i]]
    }
    return null
  }
  return instance
}

export function getIds (instance) {
  const out = {}
  Object.keys(instance).forEach((key) => {
    out[key] = getId(instance[key])
  })
  return out
}

export function getArrayIds (instance) {
  if (_.isArray(instance)) {
    return instance.map(getId)
  }
  return instance
}

// Two way: either prepare instance for internal use, or prepare form submit data, external for api;
export function getInstanceFieldValue (instance, field, forSubmit) {
  const out = {isset: false, value: field.multiple ? [] : null}
  if (!instance || !_.isObject(instance) || _.isEmpty(instance)) return out
  let value = instance
  if (forSubmit) {
    value = instance[field.key]
  } else {
    const ar = field.key.split(/\./)
    for (let i = 0; i < ar.length; i++) {
      if (value.hasOwnProperty(ar[i])) value = value[ar[i]]
      else return out
    }
  }
  value = _.cloneDeep(value)
  if (field.multiple || _.isArray(value)) {
    if (_.isArray(value)) out.value = value
    else if (_.isSet(value)) out.value.push(value)
    out.value = out.value.reduce((out, item) => {
      let valueToPush = item
      if (field.type === 'boolean') valueToPush = !!valueToPush
      if ((forSubmit && field.saveAsObject) || (!forSubmit && field.objectValue)) {
        out.push(valueToPush)
      } else if (_.isObject(valueToPush) && valueToPush.hasOwnProperty('id')) {
        out.push(valueToPush.id)
      } else if (_.isObject(valueToPush) && valueToPush.hasOwnProperty('code')) {
        out.push(valueToPush.code)
      } else if (!_.isObject(valueToPush)) {
        out.push(valueToPush)
      }
      return out
    }, [])
    out.isset = !!out.value.length
  } else {
    let valueToPush = value
    if (field.type === 'boolean') valueToPush = !!valueToPush
    if ((forSubmit && field.saveAsObject) || (!forSubmit && field.objectValue)) {
      out.value = valueToPush
    } else if (_.isObject(valueToPush) && valueToPush.hasOwnProperty('id')) {
      out.value = valueToPush.id
    } else if (_.isObject(valueToPush) && valueToPush.hasOwnProperty('code')) {
      out.value = valueToPush.code
    } else if (!_.isObject(valueToPush)) {
      out.value = valueToPush
    }
    out.isset = !!out.value
  }
  return out
}

export function prepareInstance (instance, fields) {
  const out = {}
  const usedFields = {}
  const iterableFields = (fields ? (_.isArray(fields) ? fields : _.isObject(fields) ? Object.values(fields) : []) : []) || []
  iterableFields.forEach((field) => {
    const res = getInstanceFieldValue(instance, field)
    if (!res.isset && field.hasOwnProperty('default')) out[field.key] = field.default
    else out[field.key] = res.value
    usedFields[field.key] = true
  })
  if (_.isObject(instance)) {
    Object.keys(instance).forEach((key) => {
      if (!usedFields[key]) {
        out[key] = _.cloneDeep(instance[key])
      }
    })
  }
  return out
}

export function prepareFormSubmitData (instance, fields) {
  const out = {}
  const iterableFields = (fields ? (_.isArray(fields) ? fields : _.isObject(fields) ? Object.values(fields) : []) : []) || []
  iterableFields.forEach((field) => {
    let target = out
    const ar = field.key.split(/\./)
    for (let i = 0; i < ar.length - 1; i++) {
      if (!target.hasOwnProperty(ar[i])) target[ar[i]] = {}
      target = target[ar[i]]
    }
    const res = getInstanceFieldValue(instance, field, true)
    target[field.saveAs || _.last(ar)] = res.value
  })
  return out
}

export function extractErrorResponse (error) {
  const out = {message: '', ..._.omit(error, 'response')}
  if (error.response) {
    out.code = error.response.status
    out.status = error.response.status
    out.message = error.response.statusText || `Error #${out.code}`
    if (error.response.data) {
      if (error.response.data.hasOwnProperty('message')) {
        out.message = error.response.data.message
      } else if (error.response.data.hasOwnProperty('error')) {
        out.message = error.response.data.error
      }
      if (error.response.data.hasOwnProperty('isCriticalError')) {
        out.isCriticalError = error.response.data.isCriticalError
      }
      const validationErrors = {}
      if (error.response.data.validationErrors) {
        error.response.data.validationErrors.forEach((rw) => {
          if (!validationErrors[rw.field]) validationErrors[rw.field] = []
          validationErrors[rw.field].push(rw.message)
        })
      }
      if (!_.isEmpty(validationErrors)) {
        out.validationErrors = validationErrors
      }
    }
  } else if (error instanceof Error) {
    out.message = error.message
  }
  const isMinorError = out.hasOwnProperty('isCriticalError') && !out.isCriticalError
  if (isMinorError) {
    out.minorMessage = out.message
  } else {
    out.criticalMessage = out.message
  }
  return out
}
