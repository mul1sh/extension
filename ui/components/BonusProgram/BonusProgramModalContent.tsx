import React, { ReactElement } from "react"
import SharedButton from "../Shared/SharedButton"

export default function BonusProgramModalContent(): ReactElement {
  return (
    <div className="standard_width wrap">
      <h1>Rewards program</h1>
      <div className="banner">
        <div>
          <img src="./images/claim@2x.png" alt="" />
        </div>
        <div className="claimable">
          <div className="claimable_info">Total bonus received so far</div>
          <div className="amount">36,736</div>
          <div className="claimable_info">TALLY</div>
        </div>
      </div>
      <h2>Share to receive 10%</h2>
      <p>
        Everytime somebody claims their tokens using your link, you each get 10%
        of the claim.
      </p>
      <div className="link_cta_wrap">
        <span>
          Your link:{" "}
          <span className="link">tally.cash/referral/...C11e09517BF</span>
        </span>
        <div className="bottom">
          <SharedButton
            type="primary"
            size="medium"
            iconPosition="left"
            icon="external_small"
          >
            Share
          </SharedButton>
          <SharedButton
            type="secondary"
            size="medium"
            icon="plus"
            iconPosition="left"
          >
            Copy to clipboard
          </SharedButton>
        </div>
      </div>
      <div className="public_notice">
        <div className="icon_eye" />
        Address will be visible in the link
      </div>
      <style jsx>
        {`
          .wrap {
            margin: 0 auto;
            margin-top: -25px;
          }
          h1 {
            color: var(--green-5);
            font-size: 22px;
            font-weight: 500;
            line-height: 32px;
          }
          .banner {
            width: 100%;
            border-radius: 12px;
            display: flex;
            padding: 0 4px;
            box-sizing: border-box;
            justify-content: space-between;
            align-items: center;
            padding: 0 17px;
            height: 96px;
            margin: 20px 0 8px 0;
            background-color: var(--hunter-green);
          }
          img {
            width: 89px;
            height: 69.9px;
            position: relative;
            top: -4px;
            margin-left: -3px;
          }
          .amount {
            font-family: Quincy CF;
            font-size: 36px;
            color: var(--success);
            margin-bottom: -4px;
            margin-top: -2px;
          }
          .claimable {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            margin-right: 5px;
          }
          .claimable_info {
            color: var(--green-40);
            font-weight: 500;
            text-align: center;
          }
          h2 {
            color: var(--green-20);
            font-size: 18px;
            font-weight: 600;
            line-height: 24px;
          }
          p {
            width: 321px;
            color: var(--green-40);
            font-size: 16px;
            line-height: 24px;
            margin-top: -10px;
          }
          .link_cta_wrap {
            width: 352px;
            height: 110px;
            border-radius: 12px;
            border: 1px solid var(--green-80);
            padding: 16px;
            box-sizing: border-box;
          }
          .link {
            color: var(--green-40);
          }
          .bottom {
            display: flex;
            margin-top: 16px;
            grid-gap: 19px;
          }
          .public_notice {
            width: 352px;
            height: 40px;
            border-radius: 8px;
            background-color: var(--green-120);
            display: flex;
            align-items: center;
            padding: 12px;
            box-sizing: border-box;
            margin-top: 24px;
          }
          .icon_eye {
            background: url("./images/eye@2x.png");
            background-size: 24px 24px;
            width: 24px;
            height: 24px;
            margin-right: 5px;
          }
        `}
      </style>
    </div>
  )
}
