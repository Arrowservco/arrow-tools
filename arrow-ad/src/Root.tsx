import { Composition } from "remotion";
import { ArrowAd } from "./Composition";
import { defaultContent } from "./content";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ArrowAd"
        component={ArrowAd}
        durationInFrames={900}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={defaultContent}
      />
      <Composition
        id="ArrowAdVertical"
        component={ArrowAd}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={defaultContent}
      />
    </>
  );
};
