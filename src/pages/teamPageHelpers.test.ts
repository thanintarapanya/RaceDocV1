import { describe, expect, it } from 'vitest'
import { createTeamInfoForm, createTeamInfoPayload, getTeamInfoCompletionLabel, nullableTeamText, type TeamInfo } from './teamPageHelpers'

describe('Team page helpers', () => {
  it('creates an empty Team Info form when no team exists', () => {
    expect(createTeamInfoForm()).toEqual({
      teamName: '',
      managerName: '',
      managerPhone: '',
      address: '',
      postcode: '',
    })
  })

  it('prefills the Team Info form from an existing team', () => {
    const team: TeamInfo = {
      id: 'team-1',
      teamName: 'Maxnitron Racing',
      managerName: 'Somchai Manager',
      managerPhone: null,
      address: 'Buriram paddock',
      postcode: '31000',
    }

    expect(createTeamInfoForm(team)).toEqual({
      teamName: 'Maxnitron Racing',
      managerName: 'Somchai Manager',
      managerPhone: '',
      address: 'Buriram paddock',
      postcode: '31000',
    })
  })

  it('normalizes Team Info payload text for the onboarding RPC', () => {
    expect(nullableTeamText('   ')).toBeNull()
    expect(nullableTeamText('  Race Team  ')).toBe('Race Team')
    expect(createTeamInfoPayload({
      teamName: '  Maxnitron Racing  ',
      managerName: '  Somchai Manager ',
      managerPhone: '',
      address: ' Pit 7 ',
      postcode: ' 31000 ',
    })).toEqual({
      p_team_name: 'Maxnitron Racing',
      p_manager_name: 'Somchai Manager',
      p_manager_phone: null,
      p_address: 'Pit 7',
      p_postcode: '31000',
    })
  })

  it('summarizes Team Info completion', () => {
    expect(getTeamInfoCompletionLabel(createTeamInfoForm())).toBe('0/5 details filled')
    expect(getTeamInfoCompletionLabel({
      teamName: 'Maxnitron Racing',
      managerName: 'Somchai Manager',
      managerPhone: '',
      address: '',
      postcode: '31000',
    })).toBe('3/5 details filled')
  })
})
