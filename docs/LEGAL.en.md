# Legal Notice & Disclaimer — KeeL 3D

> Last updated: 2026-09-13  
> This is a human-readable summary. It does **not** replace the full texts of  
> `LICENSE` and `docs/THIRD_PARTY_NOTICES.md`. If they conflict, the original license texts control.

---

## 1. License structure

| Layer | License | Meaning |
|---|---|---|
| **Framework & sample source code** (`src/`, `scripts/`, code in docs) | **MIT** | Free to use, modify, commercialize, and redistribute; keep copyright + license notice |
| **Third-party npm deps / decoders** | MIT or Apache-2.0 (see notices) | Follow each license; Apache requires retaining copyright & license |
| **`public/` assets** (audio / textures / models) | CC0 / CC-BY / CC-BY-SA / synthesized speech | **Outside the MIT grant**; follow asset terms |

Code you write yourself may ship under MIT or any license you choose; third-party assets you include stay under **their** terms.

---

## 2. Commercial use

**Allowed**, if you:

1. Keep the MIT copyright and license notice (`LICENSE`) in source and/or binary distributions.  
2. If your build includes CC-BY / CC-BY-SA assets from `public/`:  
   - Provide **attribution** (see `THIRD_PARTY_NOTICES.md`);  
   - **CC-BY-SA voice lines**: if you adapt and redistribute those audio files, ShareAlike may apply. To avoid that obligation, remove those files or replace them.  
3. Do not use “Specul” / “KeeL 3D” in ways that imply official endorsement as trademarks (MIT does **not** grant trademark rights).

Shipping **only** “your game + framework code + your own assets” usually needs MIT + dependency notices only — not Night Raid audio credits.

---

## 3. Disclaimer (AS IS)

THE SOFTWARE IS PROVIDED **“AS IS”**, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NONINFRINGEMENT.

IN NO EVENT SHALL THE AUTHORS, COPYRIGHT HOLDERS, OR DISTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING BUT NOT LIMITED TO PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

You are responsible for backups, isolated testing, ensuring WebGPU support on target browsers, and the legality of content you publish.

---

## 4. Fictional content

Military, cultivation, and combat themes in samples are **fiction**. They are unrelated to any real person, organization, nation, or event and do not express political, military, or religious positions. Age ratings and content compliance are the **publisher’s** responsibility under applicable law.

---

## 5. Privacy & networking

- The framework does not by default collect personal data.  
- Sample A networking uses WebRTC. If you deploy signaling (e.g. Cloudflare Pages Functions / KV), **you** operate that service and own privacy/regulatory duties.  
- `localStorage` may store preferences (volume, language, etc.). Disclose as required in your deployment.

---

## 6. Patents & export

No patent rights are granted. Comply with applicable export/sanctions laws in your jurisdiction.

---

## 7. Contributions & trademarks

- Contributions are expected to be yours to license under **MIT**.  
- “Specul”, “KeeL”, “KeeL 3D”, “KeeL 2D” are product names; open-source licenses do not grant trademark rights.

---

## 8. Contact

Use the project repository issues or official Specul channels.

**In one line:** MIT code — free to use and commercialize with notices; assets follow CC terms; software is as-is; you own what you ship.
