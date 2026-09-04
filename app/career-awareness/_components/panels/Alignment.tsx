export function Alignment() {
  return (
    <div className="bg-card rounded-b-[20px] md:rounded-b-[68px]">
      <div className="pt-[10%] md:pt-[10%] pb-8 p-3 md:p-10 md:text-[20px] 2xl:text-[24px]">
        <h2 className="font-bold">
          Expecting to have professional/managerial employment at age 30
        </h2>
        <h2 className="mt-[10px]">
          Career ambition, defined as the expectation of working in a job
          classified as managerial or professional, such as higher earnings,
          reduced unemployment, and greater career satisfaction, even after
          controlling for background variables
        </h2>
        <div className="flex lg:flex-row flex-col-reverse items-center w-[100%] mt-[40px]">
          <div className="lg:w-[60%]">
            <p>
              Career alignment refers to young people having educational plans
              that are aligned with their occupational ambitions, while career
              misalignment refers to teenagers whose educational plans are not
              aligned with their occupational ambitions. Misalignment can be
              conceived as confusion about the labour market and specifically
              the levels of education and qualifications that are typically
              required to access desired employment.
            </p>
          </div>
          <div className="w-[100%]">
            {/* eslint-disable-next-line @next/next/no-img-element -- static illustration, no next/image usage in this project */}
            <img className="lg:float-right m-auto mb-10 lg:mb-0 md:max-w-[600px] lg:w-[330px]" src="/images/career-awareness/pana2.png" alt="pana" />
          </div>
        </div>

        <div className="flex lg:flex-row flex-col items-center w-[100%] mt-[40px]">
          <div className="w-[100%]">
            {/* eslint-disable-next-line @next/next/no-img-element -- static illustration, no next/image usage in this project */}
            <img className="lg:float-left m-auto md:max-w-[600px] lg:w-[330px]" src="/images/career-awareness/bro2.png" alt="rafiki" />
          </div>
          <div className="lg:w-[60%] mt-[50px] lg:mt-0">
            <p>
              The misalignment tends to focus on teenagers who underestimate
              the level of education required to secure their career
              expectation.
            </p>
            <p>
              Teenage career alignment is significantly associated with higher
              earnings than those who were misaligned as teenagers. Teenage
              career alignment is significantly associated with higher career
              satisfaction than those who were misaligned as teenagers
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
