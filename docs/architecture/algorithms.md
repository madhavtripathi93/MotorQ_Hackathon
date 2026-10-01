# VISTA Algorithms & Mathematical Specifications

## 1. Veracity Pipeline: Stage-by-Stage Complexity

| Stage | Algorithm / Method | Input | Output | Time Complexity | Space Complexity |
|---|---|---|---|---|---|
| **1. Schema** | JSON schema & contract bounds | Raw event + Contract | Validated boolean + error codes | $O(1)$ | $O(1)$ |
| **2. Sequence** | Redis Set + Monotonic sequence tracking | `vin`, `seq` | `PIPELINE_DUPLICATE`, `PIPELINE_REORDER`, `PIPELINE_DROP` | $O(1)$ | $O(W)$ per VIN ($W=100$) |
| **3. Plausibility**| Physical derivative & rate-of-change check | $v(t)$, $v(t-1)$, $\Delta t$ | `plausibility_score` $\in [0, 1]$ | $O(1)$ | $O(1)$ |
| **4. Freshness** | Exponential temporal decay: $e^{-\lambda \Delta t}$ | Event timestamp, arrival time | `freshness_score` $\in [0, 1]$ | $O(1)$ | $O(1)$ |
| **5. Cross-Signal**| Kinematic invariant & Kalman/residual checks | Speed, GPS $\Delta x/\Delta t$, Odometer $\Delta d$ | `consistency_score` $\in [0, 1]$ | $O(1)$ | $O(1)$ |
| **6. Drift** | Jensen-Shannon Divergence (JSD) + Page-Hinkley | Window histogram $H_W$ vs Baseline $H_B$ | `drift_score` $\in [0, 1]$ + Change-point flag | $O(B)$ ($B=20$ bins) | $O(B)$ |
| **7. Attribution**| Multi-feature calibrated classifier + DiD | Residuals, cohort tag, contract diffs | Class probabilities: `VEHICLE`, `TELEMETRY`, `CONTRACT`, `UNKNOWN` | $O(K)$ features | $O(1)$ |
| **8. Trust Fusion**| Bayesian / Dempster-Shafer evidential fusion | Component scores + uncertainty $\mu$ | Calibrated Trust $T \in [0, 1]$ | $O(S)$ signals | $O(1)$ |
| **9. Policy Gate** | Threshold evaluation + allow-list check | Action request, Trust $T$, Evidence set | `ALLOW` / `REVIEW` / `BLOCK` | $O(P)$ policies | $O(1)$ |

---

## 2. Mathematical Formulations

### A. Jensen-Shannon Divergence (JSD)
To quantify statistical drift between an observed sliding window distribution $P = H_W$ and the expected contract baseline distribution $Q = H_B$:
$$M = \frac{1}{2}(P + Q)$$
$$D_{KL}(P \parallel M) = \sum_{i=1}^B P(i) \ln \frac{P(i)}{M(i)}$$
$$JSD(P \parallel Q) = \frac{1}{2} D_{KL}(P \parallel M) + \frac{1}{2} D_{KL}(Q \parallel M)$$
Since $0 \le JSD \le \ln(2)$, the normalized drift metric is:
$$S_{\text{drift}} = \sqrt{\frac{JSD(P \parallel Q)}{\ln(2)}} \in [0, 1]$$

### B. Page-Hinkley Change-Point Detection
Monitors the cumulative deviation of the signal or residual metric $x_t$ against running mean $\bar{x}$:
$$m_t = \sum_{k=1}^t (x_k - \bar{x} - \delta)$$
$$M_t = \min_{1 \le k \le t} m_k$$
$$PH_t = m_t - M_t$$
When $PH_t > \lambda_{\text{threshold}}$, an abrupt change-point is declared at timestamp $t$.

### C. Difference-in-Differences (DiD) Cohort Estimation
When an OTA software campaign is suspected of causing semantic drift, we isolate causality from external temporal shocks (e.g. cold weather, rain, or rush hour) via:
$$\text{DiD} = \left(\bar{Y}_{\text{post, treat}} - \bar{Y}_{\text{pre, treat}}\right) - \left(\bar{Y}_{\text{post, control}} - \bar{Y}_{\text{pre, control}}\right)$$
Where:
- **Treatment Cohort**: Vehicles running updated firmware (e.g. v4.7).
- **Control Cohort**: Vehicles remaining on legacy firmware (e.g. v4.6).
- **Placebo Test**: Evaluates DiD on pseudo-intervention timestamps $t_{\text{placebo}} < t_{\text{actual}}$ to ensure pre-intervention parallel trends hold ($\text{DiD}_{\text{placebo}} \approx 0$).

### D. Downstream Harm Quantification
Downstream error is computed against clean physical counterfactuals:
$$\text{RangeMAE} = \frac{1}{N}\sum_{i=1}^N \left| \text{Range}_{\text{observed}}(i) - \text{Range}_{\text{clean}}(i) \right|$$
$$\text{AvoidedImpactEstimate} = (\text{FalseVisitsAvoided} \times C_{\text{visit}}) + (\text{BlockedErroneousDispatches} \times C_{\text{dispatch}})$$
*Note: In compliance with VISTA demo guidelines, all cost figures are explicitly labeled as simulator-derived avoided-impact estimates.*
