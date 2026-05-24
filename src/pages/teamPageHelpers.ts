export type TeamInfo = {
  id: string
  teamName: string
  managerName: string | null
  managerPhone: string | null
  address: string | null
  postcode: string | null
}

export type TeamInfoForm = {
  teamName: string
  managerName: string
  managerPhone: string
  address: string
  postcode: string
}

export function createTeamInfoForm(team: TeamInfo | null = null): TeamInfoForm {
  return {
    teamName: team?.teamName ?? '',
    managerName: team?.managerName ?? '',
    managerPhone: team?.managerPhone ?? '',
    address: team?.address ?? '',
    postcode: team?.postcode ?? '',
  }
}

export function nullableTeamText(value: string) {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function createTeamInfoPayload(form: TeamInfoForm) {
  return {
    p_team_name: form.teamName.trim(),
    p_manager_name: nullableTeamText(form.managerName),
    p_manager_phone: nullableTeamText(form.managerPhone),
    p_address: nullableTeamText(form.address),
    p_postcode: nullableTeamText(form.postcode),
  }
}

export function getTeamInfoCompletionLabel(form: TeamInfoForm) {
  const values = [form.teamName, form.managerName, form.managerPhone, form.address, form.postcode]
  const complete = values.filter((value) => value.trim()).length
  return `${complete}/${values.length} details filled`
}
