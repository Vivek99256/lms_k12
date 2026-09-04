export function Originality() {
  return (
    <div className="bg-card rounded-b-[20px] md:rounded-b-[68px]">
      <div className="pt-[10%] md:pt-[10%] pb-8 p-3 md:p-10 md:text-[20px] 2xl:text-[24px]">
        <div className="flex lg:flex-row flex-col items-center w-[100%]">
          <div className="lg:w-[60%]">
            <p>
              Career originality It refers to whether the career expectations
              of students can be considered more or less original, it is
              likely that young people with more original career aspirations
              may have directed greater thought to their plans for the future.
              So career originality may be a sign of greater ultimate critical
              reflection, career maturity.
            </p>
          </div>
          <div className="w-[100%]">
            {/* eslint-disable-next-line @next/next/no-img-element -- static illustration, no next/image usage in this project */}
            <img className="lg:float-right mt-10 lg:mt-0 w-[430px]" src="/images/career-awareness/pana3.png" alt="pana" />
          </div>
        </div>

        <div className="flex lg:flex-row flex-col-reverse items-center w-[100%] mt-[40px]">
          <div className="w-[100%]">
            {/* eslint-disable-next-line @next/next/no-img-element -- static illustration, no next/image usage in this project */}
            <img className="lg:float-left w-[430px] mt-10 lg:mt-0" src="/images/career-awareness/amico.png" alt="rafiki" />
          </div>
          <div className="lg:w-[60%]">
            <p>
              Career originality are characterised by high levels of teenage
              participation in programmes of Vocational Education and
              Training, which may help explain greater variety of career
              interests. Teenagers anticipating joining such programmes
              designed to enable entrance to specific occupations can be
              expected to have received support from their schools in
              exploring the labour market prior to key decision-making
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
