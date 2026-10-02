import { useEffect, useRef, useState } from 'react'
import { api, ApiError } from '../../services/api.ts'
import { modelOption } from '../../services/jev-models.ts'
import type { JevModel } from '../../services/jev-models.ts'
import type { OAuthCallback } from './oauth.ts'
import {
  createAuthorizationUrl,
  exchangeOAuthCallback,
  OAuthError,
} from './oauth.ts'

export function useCredentials(
  callback: OAuthCallback | null,
  defaultModel: string,
  connectOpen: boolean,
) {
  const [key, setKey] = useState('')
  const [model, setModel] = useState(defaultModel)
  const [discoveredModels, setDiscoveredModels] = useState<JevModel[]>([])
  const [modelStatus, setModelStatus] = useState<
    'loading' | 'ready' | 'unavailable'
  >('loading')
  const [status, setStatus] = useState<
    'disconnected' | 'connecting' | 'connected' | 'invalid' | 'unavailable'
  >('disconnected')
  const [message, setMessage] = useState('')
  const generation = useRef(0)
  const callbackStarted = useRef(false)

  useEffect(() => {
    if (!connectOpen) return
    let active = true
    void Promise.resolve()
      .then(() => {
        if (active) setModelStatus('loading')
        return api.models()
      })
      .then(
        (models) => {
          if (!active) return
          setDiscoveredModels(models)
          setModelStatus(models.length ? 'ready' : 'unavailable')
        },
        () => {
          if (active) setModelStatus('unavailable')
        },
      )
    return () => {
      active = false
    }
  }, [connectOpen])

  const verify = async (credential: string, selectedModel: string) => {
    const current = ++generation.current
    setStatus('connecting')
    setMessage('')
    try {
      await api.checkKey({ apiKey: credential, model: selectedModel })
      if (current !== generation.current) return
      setKey(credential)
      setStatus('connected')
    } catch (error) {
      if (current !== generation.current) return
      if (error instanceof ApiError && error.code === 'invalid_key') {
        setKey('')
        setStatus('invalid')
        setMessage('OpenRouter did not accept this connection. Connect again.')
      } else {
        setStatus('unavailable')
        setMessage(
          'OpenRouter could not verify this connection. Connect again.',
        )
      }
    }
  }

  useEffect(() => {
    if (!callback || callbackStarted.current) return
    callbackStarted.current = true
    const startingGeneration = generation.current
    setStatus('connecting')
    void Promise.resolve()
      .then(() => exchangeOAuthCallback(callback, window.sessionStorage))
      .then(
        (connection) => {
          if (startingGeneration !== generation.current) return
          setModel(connection.model)
          void verify(connection.key, connection.model)
        },
        (error: unknown) => {
          if (startingGeneration !== generation.current) return
          setStatus('disconnected')
          setMessage(
            error instanceof OAuthError
              ? error.message
              : 'OpenRouter sign-in failed. Connect again.',
          )
        },
      )
    // A callback is captured once before React mounts; StrictMode must not exchange it twice.
  }, [callback])

  const connect = async () => {
    generation.current++
    setKey('')
    setStatus('connecting')
    setMessage('')
    try {
      const url = await createAuthorizationUrl(
        window.location,
        sessionStorage,
        model,
      )
      window.location.assign(url)
    } catch {
      setStatus('disconnected')
      setMessage(
        'Could not start secure OpenRouter sign-in. Check browser storage and try again.',
      )
    }
  }
  const disconnect = () => {
    generation.current++
    setKey('')
    setStatus('disconnected')
    setMessage('')
  }
  const selectModel = (selected: string) => {
    if (
      selected === model ||
      ![
        defaultModel,
        model,
        ...discoveredModels.map((item) => item.id),
      ].includes(selected)
    )
      return
    setModel(selected)
    if (key) void verify(key, selected)
  }
  const models = discoveredModels.some((item) => item.id === defaultModel)
    ? [...discoveredModels]
    : [modelOption(defaultModel), ...discoveredModels]
  if (!models.some((item) => item.id === model))
    models.unshift(modelOption(model))
  return {
    status,
    message,
    connect,
    disconnect,
    connected: status === 'connected',
    model,
    models,
    modelStatus,
    selectModel,
    credentials: { apiKey: key, model },
  }
}

export type KeySession = ReturnType<typeof useCredentials>
