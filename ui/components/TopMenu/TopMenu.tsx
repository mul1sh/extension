import React, { ReactElement, useState, useEffect, useCallback } from "react"
import { browser } from "@tallyho/tally-background"
import { PermissionRequest } from "@tallyho/provider-bridge-shared"
import {
  selectAllowedPages,
  selectCurrentAccount,
} from "@tallyho/tally-background/redux-slices/selectors"
import {
  HIDE_TOKEN_FEATURES,
  MULTI_NETWORK,
} from "@tallyho/tally-background/features"
import { denyOrRevokePermission } from "@tallyho/tally-background/redux-slices/dapp-permission"
import TopMenuProtocolSwitcher from "./TopMenuProtocolSwitcher"
import TopMenuProfileButton from "./TopMenuProfileButton"

import BonusProgramModalContent from "../BonusProgram/BonusProgramModalContent"
import AccountsNotificationPanel from "../AccountsNotificationPanel/AccountsNotificationPanel"
import SharedSlideUpMenu from "../Shared/SharedSlideUpMenu"
import TopMenuConnectedDAppInfo from "./TopMenuConnectedDAppInfo"
import TopMenuProtocolList from "./TopMenuProtocolList"

import { useBackgroundDispatch, useBackgroundSelector } from "../../hooks"

export default function TopMenu(): ReactElement {
  const [isProtocolListOpen, setIsProtocolListOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [isBonusProgramOpen, setIsBonusProgramOpen] = useState(false)

  const [isActiveDAppConnectionInfoOpen, setIsActiveDAppConnectionInfoOpen] =
    useState(false)

  const dispatch = useBackgroundDispatch()

  const [currentPermission, setCurrentPermission] = useState<PermissionRequest>(
    {} as PermissionRequest
  )
  const [isConnectedToDApp, setIsConnectedToDApp] = useState(false)

  const allowedPages = useBackgroundSelector(selectAllowedPages)
  const currentAccount = useBackgroundSelector(selectCurrentAccount)

  const initPermissionAndOrigin = useCallback(async () => {
    const { url } = await browser.tabs
      .query({
        active: true,
        lastFocusedWindow: true,
      })
      .then((tabs) =>
        tabs[0] ? tabs[0] : { url: "", favIconUrl: "", title: "" }
      )

    if (!url) return

    const { origin } = new URL(url)

    const allowPermission = allowedPages[`${origin}_${currentAccount.address}`]

    if (allowPermission) {
      setCurrentPermission(allowPermission)
      setIsConnectedToDApp(true)
    } else {
      setIsConnectedToDApp(false)
    }
  }, [allowedPages, setCurrentPermission, currentAccount])

  useEffect(() => {
    initPermissionAndOrigin()
  }, [initPermissionAndOrigin])

  const deny = useCallback(async () => {
    if (typeof currentPermission !== "undefined") {
      await dispatch(
        denyOrRevokePermission({ ...currentPermission, state: "deny" })
      )
    }
    window.close()
  }, [dispatch, currentPermission])

  return (
    <>
      {isConnectedToDApp && isActiveDAppConnectionInfoOpen ? (
        <TopMenuConnectedDAppInfo
          title={currentPermission.title}
          url={currentPermission.origin}
          faviconUrl={currentPermission.faviconUrl}
          close={() => {
            setIsActiveDAppConnectionInfoOpen(false)
          }}
          disconnect={deny}
        />
      ) : null}
      <SharedSlideUpMenu
        isOpen={isBonusProgramOpen}
        close={() => {
          setIsBonusProgramOpen(false)
        }}
        size="custom"
        customSize="497px"
      >
        <BonusProgramModalContent />
      </SharedSlideUpMenu>
      <SharedSlideUpMenu
        isOpen={isProtocolListOpen}
        close={() => {
          setIsProtocolListOpen(false)
        }}
      >
        <TopMenuProtocolList />
      </SharedSlideUpMenu>
      <SharedSlideUpMenu
        isOpen={isNotificationsOpen}
        close={() => {
          setIsNotificationsOpen(false)
        }}
      >
        <AccountsNotificationPanel
          onCurrentAddressChange={() => setIsNotificationsOpen(false)}
        />
      </SharedSlideUpMenu>
      <div className="nav_wrap">
        <nav className="standard_width_padded">
          <TopMenuProtocolSwitcher
            enabled={MULTI_NETWORK}
            onClick={() => setIsProtocolListOpen(true)}
          />
          <div className="profile_group">
            {isConnectedToDApp && (
              <button
                type="button"
                aria-label="Show current dApp connection"
                className="connection_button"
                onClick={() => {
                  setIsActiveDAppConnectionInfoOpen(
                    !isActiveDAppConnectionInfoOpen
                  )
                }}
              />
            )}
            {!HIDE_TOKEN_FEATURES && (
              <button
                type="button"
                aria-label="Rewards program"
                className="gift_button"
                onClick={() => {
                  setIsBonusProgramOpen(!isBonusProgramOpen)
                }}
              />
            )}
            <TopMenuProfileButton
              onClick={() => {
                setIsNotificationsOpen(!isNotificationsOpen)
              }}
            />
          </div>
        </nav>

        <style jsx>
          {`
            nav {
              flex-shrink: 0;
              height: 52px;
              margin-top: 6px;
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding-right: 0;
            }
            .nav_wrap {
              width: 100%;
              box-shadow: 0px 6px 11px var(--hunter-green);
              margin-bottom: 6px;
              z-index: inherit;
            }
            .profile_group {
              display: flex;
              align-items: center;
            }
            button {
              border-radius: 12px;
              border: solid 3px var(--hunter-green);
              width: 32px;
              height: 32px;
              margin-right: 2px;
            }
            button:hover {
              background-color: var(--green-80);
            }
            .connection_button {
              background: url("./images/bolt@2x.png") center no-repeat;
              background-size: 10px 20px;
            }
            .gift_button {
              background: url("./images/gift@2x.png") center no-repeat;
              background-size: 24px 24px;
            }
          `}
        </style>
      </div>
    </>
  )
}
