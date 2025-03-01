const executeNowOption = '[data-testid="execute-checkbox"]'
const executeLaterOption = '[data-testid="sign-checkbox"]'
const connectedWalletExecutionMethod = '[data-testid="connected-wallet-execution-method"]'
const txStatus = '[data-testid="transaction-status"]'
const finishTransactionBtn = '[data-testid="finish-transaction-btn"]'
const executeFormBtn = '[data-testid="execute-form-btn"]'

const executeBtnStr = 'Execute'
const txCompletedStr = 'Transaction was successful'
export const relayRemainingAttemptsStr = 'free transactions left today'

export function selectExecuteNow() {
  cy.get(executeNowOption).click()
}

export function selectExecuteLater() {
  cy.get(executeLaterOption).click()
}

export function selectConnectedWalletOption() {
  cy.get(connectedWalletExecutionMethod).click()
}

export function selectRelayOtion() {
  cy.get(connectedWalletExecutionMethod).prev().click()
}

export function clickOnExecuteBtn() {
  cy.get(executeFormBtn).click()
}

export function clickOnFinishBtn() {
  cy.get(finishTransactionBtn).click()
}

export function waitForTxToComplete() {
  cy.get(txStatus, { timeout: 240000 }).should('contain', txCompletedStr)
}

export function executeFlow_1() {
  selectExecuteNow()
  selectConnectedWalletOption()
  clickOnExecuteBtn()
  // Wait for tx to be processed
  cy.wait(60000)
  clickOnFinishBtn()
}

export function executeFlow_2() {
  selectExecuteNow()
  selectRelayOtion()
  clickOnExecuteBtn()
  // Wait for tx to be processed
  cy.wait(60000)
  clickOnFinishBtn()
}

export function executeFlow_3() {
  selectConnectedWalletOption()
  clickOnExecuteBtn()
  // Wait for tx to be processed
  cy.wait(60000)
  clickOnFinishBtn()
}
